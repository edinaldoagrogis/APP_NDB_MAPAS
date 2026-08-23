"""
Backend FastAPI — Monitor de Estresse Hídrico em Cana-de-Açúcar
AgroGIS NDB

Endpoints:
    GET  /                    - Healthcheck
    GET  /api/varieties       - Lista variedades de cana disponíveis
    POST /api/analyze/json    - Análise completa via GeoJSON no body
    POST /api/analyze         - Análise completa via upload de arquivo
    GET  /api/export/csv      - Exportar resultados em CSV
    GET  /api/export/pdf      - Exportar relatório PDF
    GET  /api/export/geojson  - Exportar GeoJSON classificado

Executar:
    uvicorn main:app --reload --port 8000
"""
from __future__ import annotations
import json
import logging
import math
import uuid
import zipfile
import io
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional, Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

# Módulos locais
from .sentinel_stac import analyze_talhoes_batch
from .soil_terrain import get_soil_terrain_for_talhao
from .ieh_calculator import calculate_ieh, DEFAULT_WEIGHTS
from .varieties_matrix import get_all_varieties, get_variety_factor
from .export_utils import results_to_csv, results_to_geojson, generate_pdf_report, get_summary_stats

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache em memória (session_id -> resultados)
results_cache: dict[str, dict] = {}

# ──────────────────────────────────────────────
# Lifespan (startup / shutdown)
# ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🌱 AgroGIS NDB — Monitor de Estresse Hídrico iniciando...")
    logger.info("📡 Usando STAC API pública (Planetary Computer + Element84) — sem GEE")
    yield
    logger.info("AgroGIS NDB — encerrando servidor.")


# ──────────────────────────────────────────────
# App FastAPI
# ──────────────────────────────────────────────
app = FastAPI(
    title="AgroGIS NDB — Monitor de Estresse Hídrico",
    description="API para análise de estresse hídrico em cana-de-açúcar via Sentinel-2 (STAC)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: permite frontend local, Vercel, Netlify e qualquer origem (dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Modelos Pydantic
# ──────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    geojson: dict
    start_date: str = ""
    end_date: str = ""
    cloud_threshold: float = 20.0
    weights: Optional[dict] = None

class WeightsModel(BaseModel):
    w1: float = 0.35
    w2: float = 0.30
    w3: float = 0.20
    w4: float = 0.15


# ──────────────────────────────────────────────
# Funções auxiliares
# ──────────────────────────────────────────────
def default_dates() -> tuple[str, str]:
    """Retorna datas padrão: últimos 45 dias."""
    end = datetime.utcnow()
    start = end - timedelta(days=45)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def extract_area_ha(feature: dict) -> float:
    """Extrai ou estima área em hectares da feature GeoJSON."""
    props = feature.get("properties", {})
    area = props.get("area_ha") or props.get("AREA") or props.get("area")
    if area:
        return float(area)
    # Estimativa pela bbox
    from shapely.geometry import shape
    geom = shape(feature["geometry"])
    # Área aproximada em graus² → converte para ha (1 grau² ≈ 12.308 km² no equador)
    area_deg2 = geom.area
    lat_c = geom.centroid.y
    area_m2 = area_deg2 * (111320 ** 2) * math.cos(math.radians(lat_c))
    return round(area_m2 / 10000, 2)


def validate_geojson(data: dict) -> list:
    """
    Valida e retorna a lista de features de um GeoJSON.
    Aceita FeatureCollection ou Feature único.
    """
    if data.get("type") == "FeatureCollection":
        features = data.get("features", [])
    elif data.get("type") == "Feature":
        features = [data]
    else:
        raise HTTPException(status_code=400, detail="GeoJSON inválido: deve ser FeatureCollection ou Feature")
    
    if not features:
        raise HTTPException(status_code=400, detail="GeoJSON sem features (talhões)")
    
    # Garante que cada feature tenha id_talhao
    for i, feat in enumerate(features):
        if "properties" not in feat:
            feat["properties"] = {}
        props = feat["properties"]
        if not props.get("id_talhao"):
            props["id_talhao"] = f"T{i+1:03d}"
        if not props.get("area_ha"):
            props["area_ha"] = extract_area_ha(feat)
    
    return features


def parse_shapefile_zip(zip_bytes: bytes) -> dict:
    """Lê Shapefile .zip e converte para GeoJSON via geopandas."""
    try:
        import geopandas as gpd
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
            z.extractall("/tmp/shp_upload")
        # Busca o .shp
        import os
        shp_files = [f for f in os.listdir("/tmp/shp_upload") if f.endswith(".shp")]
        if not shp_files:
            raise ValueError("Nenhum arquivo .shp encontrado no ZIP")
        gdf = gpd.read_file(f"/tmp/shp_upload/{shp_files[0]}")
        gdf = gdf.to_crs("EPSG:4326")
        return json.loads(gdf.to_json())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler Shapefile: {e}")


async def run_full_analysis(features: list, start_date: str, end_date: str,
                            cloud_threshold: float, weights: Optional[dict]) -> tuple[list, str]:
    """
    Orquestra a análise completa:
    1. Sentinel-2 (índices espectrais reais)
    2. Solo e Terreno (SoilGrids + OpenTopoData)
    3. IEH combinado
    
    Retorna (lista_resultados, session_id)
    """
    session_id = str(uuid.uuid4())
    
    # 1. Análise Sentinel-2
    logger.info(f"[{session_id}] Iniciando análise de {len(features)} talhões...")
    sentinel_results = analyze_talhoes_batch(
        features, start_date, end_date, cloud_threshold
    )
    
    # 2. Solo e Terreno + IEH por talhão
    resultados_finais = []
    for i, (feature, s2_result) in enumerate(zip(features, sentinel_results)):
        props = feature.get("properties", {})
        id_talhao = props.get("id_talhao", f"T{i+1}")
        variedade = props.get("variedade", "Desconhecida")
        
        # Solo e Terreno
        try:
            solo_terrain = get_soil_terrain_for_talhao(feature)
        except Exception as e:
            logger.warning(f"Erro ao buscar solo/terreno para {id_talhao}: {e}")
            solo_terrain = {"cad_factor": 0.5, "twi": 8.0, "solo": {}, "terreno": {}}
        
        # IEH
        if s2_result.get("sucesso") and s2_result.get("indices"):
            indices = s2_result["indices"]
            ieh_result = calculate_ieh(
                msi=indices.get("msi") or 1.0,
                ndwi=indices.get("ndwi") or 0.0,
                cad_factor=solo_terrain.get("cad_factor", 0.5),
                twi=solo_terrain.get("twi", 8.0),
                variety=variedade,
                weights=weights or DEFAULT_WEIGHTS
            )
        else:
            ieh_result = {
                "classe": "Sem Dados",
                "classe_num": 0,
                "cor_hex": "#94a3b8",
                "ieh_value": None,
                "descricao": s2_result.get("erro", "Sem dados de satélite")
            }
        
        resultado = {
            "id_talhao":             id_talhao,
            "variedade":             variedade,
            "area_ha":               props.get("area_ha", 0),
            "estagio_desenvolvimento": props.get("estagio_desenvolvimento", ""),
            "geometry":              feature.get("geometry"),
            "indices":               s2_result.get("indices", {}),
            "imagem":                s2_result.get("imagem", {}),
            "solo":                  solo_terrain.get("solo", {}),
            "terreno":               solo_terrain.get("terreno", {}),
            "cad_factor":            solo_terrain.get("cad_factor"),
            "twi":                   solo_terrain.get("twi"),
            **ieh_result
        }
        resultados_finais.append(resultado)
    
    # Salva no cache
    results_cache[session_id] = {
        "resultados": resultados_finais,
        "params": {
            "start_date": start_date,
            "end_date": end_date,
            "cloud_threshold": cloud_threshold
        },
        "timestamp": datetime.utcnow().isoformat()
    }
    
    return resultados_finais, session_id


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────
@app.get("/", tags=["Status"])
def healthcheck():
    """Verifica se o servidor está funcionando."""
    return {
        "status": "online",
        "servico": "AgroGIS NDB — Monitor de Estresse Hídrico",
        "versao": "1.0.0",
        "fonte_satelite": "Sentinel-2 L2A via STAC (Planetary Computer + Element84)",
        "autenticacao_necessaria": False,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/varieties", tags=["Variedades"])
def list_varieties():
    """Retorna lista de todas as variedades de cana disponíveis com seus fatores F_var."""
    return {"variedades": get_all_varieties()}


@app.post("/api/analyze/json", tags=["Análise"])
async def analyze_json(body: AnalyzeRequest):
    """
    Análise completa de estresse hídrico recebendo GeoJSON no body.
    
    - Busca imagem Sentinel-2 real sem nuvens no período
    - Calcula NDVI, NDWI, MSI, NMDI por talhão
    - Integra dados de solo (SoilGrids) e terreno (SRTM)
    - Retorna IEH classificado com legenda de cores
    """
    start = body.start_date or default_dates()[0]
    end   = body.end_date   or default_dates()[1]
    
    features = validate_geojson(body.geojson)
    
    resultados, session_id = await run_full_analysis(
        features, start, end, body.cloud_threshold, body.weights
    )
    
    geojson_out = results_to_geojson(resultados)
    stats = get_summary_stats(resultados)
    
    return {
        "session_id": session_id,
        "geojson":    geojson_out,
        "estatisticas": stats,
        "total_talhoes": len(resultados),
        "periodo": {"inicio": start, "fim": end},
    }


@app.post("/api/analyze", tags=["Análise"])
async def analyze_file(
    file: UploadFile = File(...),
    start_date: str  = Form(default=""),
    end_date: str    = Form(default=""),
    cloud_threshold: float = Form(default=20.0),
):
    """
    Análise completa via upload de arquivo.
    Aceita: GeoJSON (.geojson, .json), Shapefile (.zip), KML (.kml)
    """
    filename = file.filename.lower()
    content = await file.read()
    
    if filename.endswith(".zip"):
        geojson_data = parse_shapefile_zip(content)
    elif filename.endswith(".kml"):
        raise HTTPException(status_code=400, detail="KML: converta para GeoJSON antes do upload ou use o cliente JS")
    else:
        try:
            geojson_data = json.loads(content.decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=400, detail="Arquivo inválido: não é um GeoJSON válido")
    
    start = start_date or default_dates()[0]
    end   = end_date   or default_dates()[1]
    
    features = validate_geojson(geojson_data)
    resultados, session_id = await run_full_analysis(
        features, start, end, cloud_threshold, None
    )
    
    geojson_out = results_to_geojson(resultados)
    stats = get_summary_stats(resultados)
    
    return {
        "session_id": session_id,
        "geojson":    geojson_out,
        "estatisticas": stats,
        "total_talhoes": len(resultados),
        "periodo": {"inicio": start, "fim": end},
    }


@app.get("/api/export/csv", tags=["Exportação"])
def export_csv(session_id: str):
    """Exporta resultados em formato CSV."""
    cache = results_cache.get(session_id)
    if not cache:
        raise HTTPException(status_code=404, detail="Session não encontrada. Execute a análise primeiro.")
    
    csv_content = results_to_csv(cache["resultados"])
    filename = f"estresse_hidrico_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.get("/api/export/pdf", tags=["Exportação"])
def export_pdf(session_id: str):
    """Exporta relatório em formato PDF."""
    cache = results_cache.get(session_id)
    if not cache:
        raise HTTPException(status_code=404, detail="Session não encontrada. Execute a análise primeiro.")
    
    pdf_bytes = generate_pdf_report(cache["resultados"], cache["params"])
    filename = f"relatorio_estresse_hidrico_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.get("/api/export/geojson", tags=["Exportação"])
def export_geojson(session_id: str):
    """Exporta GeoJSON classificado com todos os atributos IEH."""
    cache = results_cache.get(session_id)
    if not cache:
        raise HTTPException(status_code=404, detail="Session não encontrada. Execute a análise primeiro.")
    
    geojson = results_to_geojson(cache["resultados"])
    return JSONResponse(content=geojson)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
