"""
Matriz de variedades de cana-de-açúcar.
"""
from __future__ import annotations

VARIETIES = [
    {"id": "RB867515", "nome_completo": "RB867515", "tolerancia_seca": "tolerante", "f_var": 0.72, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "RB92579", "nome_completo": "RB92579", "tolerancia_seca": "muito_tolerante", "f_var": 0.70, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "RB966928", "nome_completo": "RB966928", "tolerancia_seca": "tolerante", "f_var": 0.78, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "RB036066", "nome_completo": "RB036066", "tolerancia_seca": "moderada", "f_var": 0.85, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "RB975201", "nome_completo": "RB975201", "tolerancia_seca": "tolerante", "f_var": 0.75, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "RB855536", "nome_completo": "RB855536", "tolerancia_seca": "moderada", "f_var": 0.80, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "RB72454", "nome_completo": "RB72454", "tolerancia_seca": "moderada", "f_var": 0.90, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "SP80-1842", "nome_completo": "SP80-1842", "tolerancia_seca": "sensivel", "f_var": 1.10, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "SP83-2847", "nome_completo": "SP83-2847", "tolerancia_seca": "moderada", "f_var": 1.05, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "SP81-3250", "nome_completo": "SP81-3250", "tolerancia_seca": "sensivel", "f_var": 1.15, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "CTC4", "nome_completo": "CTC4", "tolerancia_seca": "sensivel", "f_var": 1.20, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "CTC9", "nome_completo": "CTC9", "tolerancia_seca": "moderada", "f_var": 1.00, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "CTC15", "nome_completo": "CTC15", "tolerancia_seca": "moderada", "f_var": 0.95, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "CTC2", "nome_completo": "CTC2", "tolerancia_seca": "muito_sensivel", "f_var": 1.25, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "CTC3", "nome_completo": "CTC3", "tolerancia_seca": "sensivel", "f_var": 1.10, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "CTC7", "nome_completo": "CTC7", "tolerancia_seca": "moderada", "f_var": 1.05, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "CTC11", "nome_completo": "CTC11", "tolerancia_seca": "moderada", "f_var": 0.98, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "IAC91-1099", "nome_completo": "IAC91-1099", "tolerancia_seca": "moderada", "f_var": 0.88, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "IAC95-5000", "nome_completo": "IAC95-5000", "tolerancia_seca": "moderada", "f_var": 0.92, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "VAT90212", "nome_completo": "VAT90212", "tolerancia_seca": "sensivel", "f_var": 1.18, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "IACSP94-2094", "nome_completo": "IACSP94-2094", "tolerancia_seca": "tolerante", "f_var": 0.82, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "IACSP95-5000", "nome_completo": "IACSP95-5000", "tolerancia_seca": "moderada", "f_var": 0.95, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "RB011941", "nome_completo": "RB011941", "tolerancia_seca": "muito_tolerante", "f_var": 0.73, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "SP91-1049", "nome_completo": "SP91-1049", "tolerancia_seca": "sensivel", "f_var": 1.08, "ciclo": "desconhecido", "observacoes": ""},
    {"id": "Desconhecida", "nome_completo": "Desconhecida", "tolerancia_seca": "moderada", "f_var": 1.00, "ciclo": "desconhecido", "observacoes": ""}
]

def get_variety_factor(variety_name: str) -> float:
    if not variety_name:
        return 1.0
    v_lower = variety_name.lower()
    for v in VARIETIES:
        if v["id"].lower() in v_lower:
            return v["f_var"]
    return 1.0

def get_all_varieties() -> list:
    return VARIETIES

def get_variety_info(variety_name: str) -> dict | None:
    if not variety_name:
        return None
    v_lower = variety_name.lower()
    for v in VARIETIES:
        if v["id"].lower() in v_lower:
            return v
    return None
