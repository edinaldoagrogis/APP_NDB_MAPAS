"""
Calculador do Índice de Estresse Hídrico Combinado (IEH)
Combina índices espectrais do Sentinel-2, propriedades de solo e relevo.
"""
from __future__ import annotations
from typing import Optional
from .varieties_matrix import get_variety_factor

# Pesos padrão do IEH
DEFAULT_WEIGHTS = {"w1": 0.35, "w2": 0.30, "w3": 0.20, "w4": 0.15}

# Classes IEH
IEH_CLASSES = [
    {"classe": "Sem Estresse", "classe_num": 1, "cor_hex": "#22c55e", "cor_nome": "verde",
     "descricao": "Conforto hídrico adequado", "min": 0.0, "max": 0.25},
    {"classe": "Estresse Leve", "classe_num": 2, "cor_hex": "#eab308", "cor_nome": "amarelo",
     "descricao": "Alerta: monitorar irrigação", "min": 0.25, "max": 0.50},
    {"classe": "Estresse Moderado", "classe_num": 3, "cor_hex": "#f97316", "cor_nome": "laranja",
     "descricao": "Estresse significativo: irrigar", "min": 0.50, "max": 0.75},
    {"classe": "Estresse Severo", "classe_num": 4, "cor_hex": "#ef4444", "cor_nome": "vermelho",
     "descricao": "Crítico: intervir imediatamente", "min": 0.75, "max": 1.0},
]

# Intervalos de referência dos índices brutos para normalização
INDEX_RANGES = {
    "msi":  {"min": 0.1,  "max": 3.0},   # MSI: seco > 1.0, úmido < 0.4
    "ndwi": {"min": -0.5, "max": 0.5},   # NDWI: positivo = mais água
    "cad":  {"min": 0.0,  "max": 1.0},   # CAD já normalizado 0-1
    "twi":  {"min": 4.0,  "max": 15.0},  # TWI: > 10 = áreas úmidas/planas
}

def normalize(value: float, min_val: float, max_val: float) -> float:
    """Normaliza um valor para o intervalo [0, 1]."""
    if max_val == min_val:
        return 0.5
    clamped = max(min_val, min(max_val, value))
    return (clamped - min_val) / (max_val - min_val)

def classify_ieh(ieh_value: float) -> dict:
    """Classifica o valor IEH em uma das 4 classes de estresse."""
    for cls in IEH_CLASSES:
        if cls["min"] <= ieh_value <= cls["max"]:
            return {**cls, "ieh_value": round(ieh_value, 4)}
    # Fallback para valor acima de 1.0
    return {**IEH_CLASSES[-1], "ieh_value": round(min(ieh_value, 1.0), 4)}

def calculate_ieh(
    msi: float,
    ndwi: float,
    cad_factor: float,
    twi: float,
    variety: str = "Desconhecida",
    weights: Optional[dict] = None
) -> dict:
    """
    Calcula o IEH combinado para um talhão.
    
    Parâmetros:
        msi: Moisture Stress Index (B11/B8) - valor bruto
        ndwi: Normalized Difference Water Index ((B8-B11)/(B8+B11))
        cad_factor: Fator de Capacidade de Água Disponível [0-1]
        twi: Topographic Wetness Index (valor bruto)
        variety: Nome da variedade de cana para aplicar F_var
        weights: Dict com pesos {w1, w2, w3, w4} (soma deve ser 1.0)
    
    Retorna:
        Dict com valor IEH, classe, cor, componentes individuais
    """
    w = weights or DEFAULT_WEIGHTS
    
    # Validação de pesos
    total_w = sum(w.values())
    if abs(total_w - 1.0) > 0.01:
        # Normaliza pesos para somarem 1
        w = {k: v / total_w for k, v in w.items()}
    
    # Normalização dos componentes (0 = sem estresse, 1 = máximo estresse)
    msi_norm = normalize(msi, INDEX_RANGES["msi"]["min"], INDEX_RANGES["msi"]["max"])
    # NDWI: negativo = sem água = mais estresse; inverte para que 1 = estresse máximo
    ndwi_norm = 1.0 - normalize(ndwi, INDEX_RANGES["ndwi"]["min"], INDEX_RANGES["ndwi"]["max"])
    # CAD: alto CAD = mais água disponível = menos estresse; inverte
    cad_norm = 1.0 - normalize(cad_factor, INDEX_RANGES["cad"]["min"], INDEX_RANGES["cad"]["max"])
    # TWI: alto TWI = área úmida = menos estresse; inverte
    twi_norm = 1.0 - normalize(twi, INDEX_RANGES["twi"]["min"], INDEX_RANGES["twi"]["max"])
    
    # Fator de correção por variedade
    f_var = get_variety_factor(variety)
    
    # Fórmula IEH
    ieh_raw = (
        w["w1"] * msi_norm +
        w["w2"] * ndwi_norm +
        w["w3"] * cad_norm +
        w["w4"] * twi_norm
    ) * f_var
    
    # Clamp final [0, 1]
    ieh_value = max(0.0, min(1.0, ieh_raw))
    
    resultado = classify_ieh(ieh_value)
    resultado.update({
        "componentes": {
            "msi_bruto": round(msi, 4),
            "msi_norm": round(msi_norm, 4),
            "ndwi_bruto": round(ndwi, 4),
            "ndwi_norm": round(ndwi_norm, 4),
            "cad_factor": round(cad_factor, 4),
            "cad_norm": round(cad_norm, 4),
            "twi_bruto": round(twi, 4),
            "twi_norm": round(twi_norm, 4),
            "f_var": round(f_var, 3),
            "variedade": variety,
            "pesos": w,
        }
    })
    return resultado

def calculate_ieh_batch(talhoes_data: list, weights: Optional[dict] = None) -> list:
    """
    Calcula IEH para múltiplos talhões.
    
    Parâmetros:
        talhoes_data: Lista de dicts com {id_talhao, variedade, msi, ndwi, cad_factor, twi, ...}
    Retorna:
        Lista de dicts com resultado IEH por talhão
    """
    resultados = []
    for talhao in talhoes_data:
        try:
            resultado = calculate_ieh(
                msi=float(talhao.get("msi", 1.0)),
                ndwi=float(talhao.get("ndwi", 0.0)),
                cad_factor=float(talhao.get("cad_factor", 0.5)),
                twi=float(talhao.get("twi", 8.0)),
                variety=talhao.get("variedade", "Desconhecida"),
                weights=weights
            )
            resultado["id_talhao"] = talhao.get("id_talhao", "")
            resultados.append(resultado)
        except Exception as e:
            resultados.append({
                "id_talhao": talhao.get("id_talhao", ""),
                "erro": str(e),
                "classe": "Erro",
                "ieh_value": None
            })
    return resultados
