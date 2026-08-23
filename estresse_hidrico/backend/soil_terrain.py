"""
Módulo de dados de Solo e Relevo usando APIs públicas gratuitas.
- SoilGrids REST API v2.0 (ISRIC): textura do solo (argila, areia, silte)
- OpenTopoData API: altitude SRTM30 em múltiplos pontos para cálculo de slope/TWI
Nenhuma autenticação necessária.
"""
from __future__ import annotations
import math
import logging
from typing import Optional

import httpx
import numpy as np
from shapely.geometry import shape, Point

logger = logging.getLogger(__name__)

# APIs gratuitas
SOILGRIDS_API = "https://rest.isric.org/soilgrids/v2.0/properties/query"
OPENTOPO_API  = "https://api.opentopodata.org/v1/srtm30m"

# Timeout das requisições
HTTP_TIMEOUT = 30.0


def get_centroid(feature: dict) -> tuple:
    """Retorna (longitude, latitude) do centroide da feature."""
    geom = shape(feature["geometry"] if "geometry" not in feature else feature["geometry"])
    c = geom.centroid
    return round(c.x, 6), round(c.y, 6)


def get_sample_points(feature: dict, n_points: int = 9) -> list:
    """
    Gera pontos amostrais internos ao talhão para estimativa de slope/TWI.
    Usa grid regular dentro do bounding box, filtrado pela geometria.
    """
    geom = shape(feature["geometry"])
    minx, miny, maxx, maxy = geom.bounds
    
    points = []
    steps = int(math.sqrt(n_points)) + 1
    
    for i in range(steps + 1):
        for j in range(steps + 1):
            lng = minx + (maxx - minx) * i / steps
            lat = miny + (maxy - miny) * j / steps
            pt = Point(lng, lat)
            if geom.contains(pt):
                points.append((round(lng, 6), round(lat, 6)))
    
    # Garante pelo menos o centroide
    if not points:
        cx, cy = get_centroid(feature)
        points = [(cx, cy)]
    
    return points[:n_points]  # Limita para não sobrecarregar a API


def fetch_soilgrids_data(lon: float, lat: float) -> dict:
    """
    Busca dados de textura do solo no SoilGrids API (ISRIC).
    Retorna argila, areia e silte em % para profundidade 0-5cm.
    
    Documentação: https://www.isric.org/explore/soilgrids/faq-soilgrids
    """
    params = {
        "lon": lon,
        "lat": lat,
        "property": ["clay", "sand", "silt"],
        "depth": ["0-5cm"],
        "value": ["mean"],
    }
    
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT) as client:
            response = client.get(SOILGRIDS_API, params=params)
            response.raise_for_status()
            data = response.json()
        
        result = {"clay_pct": None, "sand_pct": None, "silt_pct": None}
        
        layers = data.get("properties", {}).get("layers", [])
        for layer in layers:
            name = layer.get("name", "")
            depths = layer.get("depths", [])
            if depths:
                val = depths[0].get("values", {}).get("mean")
                if val is not None:
                    # SoilGrids retorna valores * 10 (g/kg * 10 = ‰)
                    # Para clay/sand/silt: valor / 10 = % (já que unidade é g/kg, divide por 10 para %)
                    pct = val / 10.0
                    if name == "clay":
                        result["clay_pct"] = round(pct, 1)
                    elif name == "sand":
                        result["sand_pct"] = round(pct, 1)
                    elif name == "silt":
                        result["silt_pct"] = round(pct, 1)
        
        # Silt pode ser calculado se não vier da API
        if result["silt_pct"] is None and result["clay_pct"] is not None and result["sand_pct"] is not None:
            result["silt_pct"] = round(max(0, 100 - result["clay_pct"] - result["sand_pct"]), 1)
        
        return result
        
    except Exception as e:
        logger.warning(f"SoilGrids API falhou para ({lon},{lat}): {e}")
        # Retorna valores padrão (solo argiloso típico do Cerrado)
        return {"clay_pct": 40.0, "sand_pct": 35.0, "silt_pct": 25.0, "fonte": "padrao_cerrado"}


def estimate_cad(clay_pct: float, sand_pct: float) -> float:
    """
    Estima a Capacidade de Água Disponível (CAD) em mm/20cm usando
    pedofunção simplificada baseada em Saxton & Rawls (2006).
    
    Retorna valor normalizado [0, 1] onde:
        0.0 = solo arenoso puro (baixa CAD, ~30mm/m)
        1.0 = solo argiloso (alta CAD, ~200mm/m)
    """
    silt_pct = max(0, 100 - clay_pct - sand_pct)
    
    # Umidade na Capacidade de Campo (CC) aproximada
    cc = 0.299 - (0.251 * sand_pct/100) + (0.195 * clay_pct/100) + (0.011 * silt_pct/100)
    # Umidade no Ponto de Murcha Permanente (PMP) aproximada
    pmp = 0.060 + (0.0059 * clay_pct) + (0.000584 * clay_pct**2)
    pmp = max(0.01, min(pmp, 0.40))
    
    # CAD em cm³/cm³
    cad_vol = max(0.01, cc - pmp)
    
    # Normaliza: referência máxima ~0.20 cm³/cm³ (solo muito argiloso)
    cad_norm = min(1.0, cad_vol / 0.20)
    
    return round(cad_norm, 3)


def fetch_elevation_points(points: list) -> list:
    """
    Busca elevação SRTM30m para múltiplos pontos via OpenTopoData API.
    Retorna lista de elevações em metros.
    
    API gratuita: https://www.opentopodata.org/
    """
    if not points:
        return []
    
    # Formato: "lat,lon|lat,lon|..."
    locations_str = "|".join([f"{lat},{lon}" for lon, lat in points])
    
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT) as client:
            response = client.get(
                OPENTOPO_API,
                params={"locations": locations_str}
            )
            response.raise_for_status()
            data = response.json()
        
        elevations = []
        for result in data.get("results", []):
            elev = result.get("elevation")
            if elev is not None:
                elevations.append(float(elev))
        
        return elevations
        
    except Exception as e:
        logger.warning(f"OpenTopoData API falhou: {e}")
        return []


def calculate_slope_from_elevations(points: list, elevations: list) -> float:
    """
    Estima a declividade média do talhão a partir de pontos de elevação.
    
    Calcula a variação de elevação entre pontos vizinhos
    dividida pela distância horizontal (em graus ≈ metros).
    Retorna declividade em graus.
    """
    if len(elevations) < 2:
        return 2.0  # Valor padrão moderado
    
    slopes = []
    for i in range(len(points) - 1):
        lon1, lat1 = points[i]
        lon2, lat2 = points[i+1]
        e1 = elevations[i]
        e2 = elevations[i+1]
        
        # Distância horizontal aproximada (1° ≈ 111km)
        dist_m = math.sqrt(
            ((lon2 - lon1) * 111320 * math.cos(math.radians((lat1+lat2)/2))) ** 2 +
            ((lat2 - lat1) * 110540) ** 2
        )
        
        if dist_m > 1:
            slope_deg = math.degrees(math.atan(abs(e2 - e1) / dist_m))
            slopes.append(slope_deg)
    
    return round(np.median(slopes) if slopes else 2.0, 2)


def calculate_twi(slope_deg: float, area_ha: float = 5.0) -> float:
    """
    Calcula o Topographic Wetness Index (TWI) simplificado.
    
    TWI = ln(contributing_area / tan(slope_rad))
    
    Para áreas sem dados de fluxo acumulado, usa a área do talhão
    como proxy da área de contribuição.
    
    Referência: Beven & Kirkby (1979)
    """
    slope_rad = math.radians(max(0.1, slope_deg))  # Evita divisão por zero
    tan_slope = math.tan(slope_rad)
    
    # Área de contribuição em m² (usa 10x a área do talhão como proxy)
    contrib_area_m2 = area_ha * 10000 * 2
    
    twi = math.log(contrib_area_m2 / tan_slope)
    return round(max(1.0, min(25.0, twi)), 2)


def get_soil_terrain_for_talhao(feature: dict) -> dict:
    """
    Função principal: busca todos os dados de solo e terreno para um talhão.
    
    Etapas:
    1. Solo: SoilGrids API no centroide do talhão
    2. Terreno: OpenTopoData em múltiplos pontos + cálculo de slope/TWI
    
    Retorna dict consolidado com todos os dados para o cálculo do IEH.
    """
    props = feature.get("properties", {})
    area_ha = float(props.get("area_ha", 5.0))
    id_talhao = props.get("id_talhao", "?")
    
    lon, lat = get_centroid(feature)
    logger.info(f"Buscando solo/terreno para talhão {id_talhao} em ({lon:.4f}, {lat:.4f})")
    
    # 1. Dados de Solo (SoilGrids)
    solo = fetch_soilgrids_data(lon, lat)
    clay_pct  = solo.get("clay_pct") or 35.0
    sand_pct  = solo.get("sand_pct") or 40.0
    silt_pct  = solo.get("silt_pct") or 25.0
    cad_norm  = estimate_cad(clay_pct, sand_pct)
    
    # 2. Dados de Terreno (OpenTopoData)
    sample_pts = get_sample_points(feature, n_points=5)
    elevacoes  = fetch_elevation_points(sample_pts)
    
    elev_media = round(float(np.mean(elevacoes)), 1) if elevacoes else 400.0
    slope_deg  = calculate_slope_from_elevations(sample_pts, elevacoes) if len(elevacoes) >= 2 else 2.0
    twi        = calculate_twi(slope_deg, area_ha)
    
    return {
        "solo": {
            "argila_pct": clay_pct,
            "areia_pct":  sand_pct,
            "silte_pct":  silt_pct,
            "cad_estimada_norm": cad_norm,
            "classificacao_textural": classify_soil_texture(clay_pct, sand_pct, silt_pct),
        },
        "terreno": {
            "elevacao_media_m": elev_media,
            "declividade_graus": slope_deg,
            "declividade_pct": round(math.tan(math.radians(slope_deg)) * 100, 1),
            "twi": twi,
        },
        "cad_factor": cad_norm,
        "twi": twi,
    }


def classify_soil_texture(clay: float, sand: float, silt: float) -> str:
    """Classifica textura do solo pelo triângulo textural simplificado (USDA)."""
    if clay >= 40:
        return "Argiloso"
    elif clay >= 27 and sand < 45:
        return "Franco-Argiloso"
    elif clay >= 20 and sand >= 45:
        return "Franco-Argilo-Arenoso"
    elif sand >= 70:
        return "Arenoso"
    elif silt >= 50:
        return "Siltoso"
    else:
        return "Franco"
