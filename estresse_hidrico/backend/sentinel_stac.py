"""
Pipeline de acesso ao Sentinel-2 L2A via STAC API pública.
Usa Microsoft Planetary Computer + Element84 Earth Search como fallback.
Não requer conta GEE — acesso 100% gratuito e público.
"""
from __future__ import annotations
import asyncio
import logging
from typing import Optional
from datetime import datetime, timedelta

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union
import geopandas as gpd

try:
    import pystac_client
    import planetary_computer
    STAC_AVAILABLE = True
except ImportError:
    STAC_AVAILABLE = False

logger = logging.getLogger(__name__)

# Endpoints STAC (sem autenticação)
STAC_ENDPOINTS = [
    "https://planetarycomputer.microsoft.com/api/stac/v1",
    "https://earth-search.aws.element84.com/v1",
]

# Mapeamento de nome de banda por endpoint
BAND_NAMES = {
    "planetary": {"B04": "B04", "B08": "B08", "B8A": "B8A", "B11": "B11", "B12": "B12", "SCL": "SCL"},
    "element84": {"B04": "red", "B08": "nir", "B8A": "nir08", "B11": "swir16", "B12": "swir22", "SCL": "scl"},
}


def get_bbox_from_geojson(geojson_feature) -> list:
    """Extrai bounding box [minx, miny, maxx, maxy] de uma feature GeoJSON."""
    geom = shape(geojson_feature["geometry"])
    return list(geom.bounds)


def get_bbox_from_features(features: list) -> list:
    """Extrai bbox combinado de múltiplas features."""
    geoms = [shape(f["geometry"]) for f in features]
    combined = unary_union(geoms)
    return list(combined.bounds)


def search_sentinel2_scenes(
    bbox: list,
    start_date: str,
    end_date: str,
    cloud_threshold: float = 20.0,
    max_items: int = 10
) -> list:
    """
    Busca cenas Sentinel-2 L2A via STAC API.
    Retorna lista de items STAC ordenados por menor cobertura de nuvem.
    """
    if not STAC_AVAILABLE:
        raise ImportError("pystac-client não instalado. Execute: pip install pystac-client planetary-computer")
    
    items_found = []
    
    # Tenta Planetary Computer primeiro
    for endpoint_url in STAC_ENDPOINTS:
        try:
            is_planetary = "planetary" in endpoint_url
            
            if is_planetary:
                catalog = pystac_client.Client.open(
                    endpoint_url,
                    modifier=planetary_computer.sign_inplace
                )
                collection = "sentinel-2-l2a"
            else:
                catalog = pystac_client.Client.open(endpoint_url)
                collection = "sentinel-2-l2a"
            
            search = catalog.search(
                collections=[collection],
                bbox=bbox,
                datetime=f"{start_date}/{end_date}",
                query={"eo:cloud_cover": {"lt": cloud_threshold}},
                max_items=max_items,
                sortby="+properties.eo:cloud_cover",
            )
            
            items = list(search.items())
            if items:
                logger.info(f"Encontradas {len(items)} cenas no endpoint {endpoint_url}")
                # Marca qual endpoint foi usado
                for item in items:
                    item._stac_endpoint = "planetary" if is_planetary else "element84"
                items_found = items
                break
                
        except Exception as e:
            logger.warning(f"Falha no endpoint {endpoint_url}: {e}")
            continue
    
    return items_found


def read_band_from_stac_item(item, band_key: str, bbox_wgs84: list, scale: int = 20) -> Optional[np.ndarray]:
    """
    Lê uma banda específica de um item STAC como array numpy.
    Usa leitura por janela (windowed read) para eficiência.
    
    Parâmetros:
        item: Item STAC (Planetary Computer ou Element84)
        band_key: Ex: 'B04', 'B08', 'B11'
        bbox_wgs84: [minx, miny, maxx, maxy] em WGS84
        scale: Resolução espacial em metros (10, 20 ou 60)
    """
    endpoint_type = getattr(item, "_stac_endpoint", "planetary")
    band_map = BAND_NAMES[endpoint_type]
    asset_name = band_map.get(band_key)
    
    if not asset_name or asset_name not in item.assets:
        # Tenta nome direto como fallback
        if band_key.lower() in item.assets:
            asset_name = band_key.lower()
        elif band_key in item.assets:
            asset_name = band_key
        else:
            logger.warning(f"Banda {band_key} não encontrada no item {item.id}")
            return None
    
    asset = item.assets[asset_name]
    href = asset.href
    
    try:
        with rasterio.open(href) as src:
            # Transforma bbox WGS84 para CRS do raster
            src_crs = src.crs
            bbox_native = transform_bounds("EPSG:4326", src_crs, *bbox_wgs84)
            
            # Janela de leitura
            window = from_bounds(*bbox_native, transform=src.transform)
            
            # Calcula fator de escala para resolução alvo
            out_shape = (
                max(1, int((bbox_native[3] - bbox_native[1]) / scale)),
                max(1, int((bbox_native[2] - bbox_native[0]) / scale)),
            )
            
            data = src.read(
                1,
                window=window,
                out_shape=out_shape,
                resampling=Resampling.bilinear
            ).astype(np.float32)
            
            # Converte de DN para reflectância de superfície (divisor padrão S2)
            data = data / 10000.0
            # Mask de valores inválidos
            data[data <= 0] = np.nan
            data[data > 1.5] = np.nan
            
            return data
            
    except Exception as e:
        logger.error(f"Erro ao ler banda {band_key} do item {item.id}: {e}")
        return None


def calculate_spectral_indices(bands: dict) -> dict:
    """
    Calcula índices espectrais a partir das bandas do Sentinel-2.
    
    Parâmetros:
        bands: Dict com arrays numpy {'B04', 'B08', 'B8A', 'B11', 'B12'}
    
    Retorna:
        Dict com arrays de índices {'ndvi', 'ndwi', 'msi', 'nmdi'}
    """
    b4  = bands.get("B04")  # Red
    b8  = bands.get("B08")  # NIR
    b11 = bands.get("B11")  # SWIR-1
    b12 = bands.get("B12")  # SWIR-2
    
    indices = {}
    
    with np.errstate(divide="ignore", invalid="ignore"):
        # NDVI: (NIR - Red) / (NIR + Red)
        if b8 is not None and b4 is not None:
            denom = b8 + b4
            indices["ndvi"] = np.where(denom != 0, (b8 - b4) / denom, np.nan)
        
        # NDWI/NDII: (NIR - SWIR1) / (NIR + SWIR1)
        if b8 is not None and b11 is not None:
            denom = b8 + b11
            indices["ndwi"] = np.where(denom != 0, (b8 - b11) / denom, np.nan)
        
        # MSI: SWIR1 / NIR
        if b11 is not None and b8 is not None:
            indices["msi"] = np.where(b8 != 0, b11 / b8, np.nan)
        
        # NMDI: (NIR - (SWIR1 - SWIR2)) / (NIR + (SWIR1 - SWIR2))
        if b8 is not None and b11 is not None and b12 is not None:
            diff = b11 - b12
            denom = b8 + diff
            indices["nmdi"] = np.where(denom != 0, (b8 - diff) / denom, np.nan)
    
    return indices


def compute_zonal_stats_from_arrays(indices: dict, bbox_wgs84: list, geometry_geojson: dict) -> dict:
    """
    Calcula estatísticas zonais (média, mediana, std) dos índices sobre a geometria do talhão.
    
    Usa máscara vetorial sobre os arrays numpy.
    """
    from rasterio.transform import from_bounds as rasterio_from_bounds
    from rasterio.features import geometry_mask
    
    geom = shape(geometry_geojson["geometry"] if "geometry" in geometry_geojson else geometry_geojson)
    minx, miny, maxx, maxy = bbox_wgs84
    
    stats = {}
    
    for index_name, array in indices.items():
        if array is None:
            continue
        try:
            rows, cols = array.shape
            if rows < 1 or cols < 1:
                continue
            
            # Transform do array para coordenadas
            transform = rasterio_from_bounds(minx, miny, maxx, maxy, cols, rows)
            
            # Cria máscara da geometria
            mask = geometry_mask(
                [mapping(geom)],
                out_shape=(rows, cols),
                transform=transform,
                invert=True  # True = pixels dentro da geometria
            )
            
            # Aplica máscara
            values = array[mask & ~np.isnan(array)]
            
            if len(values) > 0:
                stats[index_name] = {
                    "mean": float(np.nanmean(values)),
                    "median": float(np.nanmedian(values)),
                    "std": float(np.nanstd(values)),
                    "min": float(np.nanmin(values)),
                    "max": float(np.nanmax(values)),
                    "pixel_count": int(len(values)),
                }
            else:
                stats[index_name] = None
        except Exception as e:
            logger.warning(f"Erro ao calcular stats zonais para {index_name}: {e}")
            stats[index_name] = None
    
    return stats


def analyze_talhao(
    feature: dict,
    start_date: str,
    end_date: str,
    cloud_threshold: float = 20.0
) -> dict:
    """
    Analisa um único talhão:
    1. Busca melhor cena Sentinel-2 (menor nuvem) no período
    2. Lê as bandas B4, B8, B11, B12
    3. Calcula índices espectrais NDVI, NDWI, MSI, NMDI
    4. Calcula estatísticas zonais sobre a geometria do talhão
    
    Retorna dict com médias dos índices e metadata da imagem.
    """
    props = feature.get("properties", {})
    id_talhao = props.get("id_talhao", props.get("ID", "desconhecido"))
    
    logger.info(f"Analisando talhão {id_talhao}...")
    
    bbox = get_bbox_from_geojson(feature)
    # Adiciona margem de 0.01° (~1km) ao bbox para garantir cobertura
    bbox_padded = [bbox[0]-0.01, bbox[1]-0.01, bbox[2]+0.01, bbox[3]+0.01]
    
    # Busca cenas Sentinel-2
    items = search_sentinel2_scenes(
        bbox=bbox_padded,
        start_date=start_date,
        end_date=end_date,
        cloud_threshold=cloud_threshold
    )
    
    if not items:
        logger.warning(f"Nenhuma cena Sentinel-2 encontrada para talhão {id_talhao} no período {start_date} a {end_date} com nuvens < {cloud_threshold}%")
        return {
            "id_talhao": id_talhao,
            "sucesso": False,
            "erro": f"Nenhuma imagem disponível para o período {start_date} a {end_date} com cobertura de nuvens < {cloud_threshold}%",
            "sugestao": "Tente ampliar o período ou aumentar o threshold de nuvens"
        }
    
    # Usa a cena com menor cobertura de nuvens
    best_item = items[0]
    cloud_cover = best_item.properties.get("eo:cloud_cover", -1)
    scene_date = best_item.properties.get("datetime", "")[:10]
    
    logger.info(f"Melhor cena: {best_item.id} | Data: {scene_date} | Nuvens: {cloud_cover:.1f}%")
    
    # Lê bandas necessárias
    bands_needed = ["B04", "B08", "B11", "B12"]
    bands = {}
    for band in bands_needed:
        arr = read_band_from_stac_item(best_item, band, bbox, scale=20)
        if arr is not None:
            bands[band] = arr
    
    if len(bands) < 2:
        return {
            "id_talhao": id_talhao,
            "sucesso": False,
            "erro": f"Falha ao ler bandas do Sentinel-2 para a cena {best_item.id}"
        }
    
    # Calcula índices espectrais
    indices = calculate_spectral_indices(bands)
    
    # Estatísticas zonais por talhão
    stats = compute_zonal_stats_from_arrays(indices, bbox, feature)
    
    # Extrai médias para o cálculo do IEH
    result = {
        "id_talhao": id_talhao,
        "sucesso": True,
        "imagem": {
            "id_cena": best_item.id,
            "data_imagem": scene_date,
            "cobertura_nuvens_pct": round(cloud_cover, 1),
            "plataforma": best_item.properties.get("platform", "Sentinel-2")
        },
        "indices": {
            "ndvi":  round(stats.get("ndvi", {}).get("mean", float("nan")), 4) if stats.get("ndvi") else None,
            "ndwi":  round(stats.get("ndwi", {}).get("mean", float("nan")), 4) if stats.get("ndwi") else None,
            "msi":   round(stats.get("msi",  {}).get("mean", float("nan")), 4) if stats.get("msi")  else None,
            "nmdi":  round(stats.get("nmdi", {}).get("mean", float("nan")), 4) if stats.get("nmdi") else None,
        },
        "stats_completas": stats
    }
    
    return result


def analyze_talhoes_batch(
    features: list,
    start_date: str,
    end_date: str,
    cloud_threshold: float = 20.0,
    progress_callback=None
) -> list:
    """
    Analisa múltiplos talhões sequencialmente.
    Trata erros por talhão individualmente (um erro não para os demais).
    """
    resultados = []
    total = len(features)
    
    for i, feature in enumerate(features):
        if progress_callback:
            progress_callback(i, total, f"Analisando talhão {i+1}/{total}...")
        
        resultado = analyze_talhao(feature, start_date, end_date, cloud_threshold)
        resultados.append(resultado)
    
    if progress_callback:
        progress_callback(total, total, "Análise Sentinel-2 concluída")
    
    return resultados
