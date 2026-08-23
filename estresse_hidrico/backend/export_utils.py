"""
Funções de exportação de resultados da análise de estresse hídrico.
Suporta: GeoJSON, CSV e PDF (relatório profissional).
"""
from __future__ import annotations
import csv
import io
import json
from datetime import datetime
from typing import Optional


def results_to_geojson(talhoes_resultados: list) -> dict:
    """
    Converte lista de resultados de análise para GeoJSON FeatureCollection.
    Cada feature inclui todos os atributos do IEH para uso em SIG.
    """
    features = []
    for r in talhoes_resultados:
        if not r.get("geometry"):
            continue
        
        props = {
            "id_talhao":      r.get("id_talhao", ""),
            "variedade":      r.get("variedade", ""),
            "area_ha":        r.get("area_ha", 0),
            "estagio":        r.get("estagio_desenvolvimento", ""),
            # Índices espectrais
            "ndvi":           r.get("indices", {}).get("ndvi"),
            "ndwi":           r.get("indices", {}).get("ndwi"),
            "msi":            r.get("indices", {}).get("msi"),
            "nmdi":           r.get("indices", {}).get("nmdi"),
            # Solo
            "argila_pct":     r.get("solo", {}).get("argila_pct"),
            "areia_pct":      r.get("solo", {}).get("areia_pct"),
            "textura_solo":   r.get("solo", {}).get("classificacao_textural"),
            "cad_norm":       r.get("cad_factor"),
            # Terreno
            "declividade_graus": r.get("terreno", {}).get("declividade_graus"),
            "twi":            r.get("twi"),
            # IEH
            "ieh_value":      r.get("ieh_value"),
            "ieh_classe":     r.get("classe"),
            "ieh_classe_num": r.get("classe_num"),
            "ieh_cor":        r.get("cor_hex"),
            "ieh_descricao":  r.get("descricao"),
            # Imagem
            "data_imagem":    r.get("imagem", {}).get("data_imagem"),
            "cena_sentinel2": r.get("imagem", {}).get("id_cena"),
            "cobertura_nuvens_pct": r.get("imagem", {}).get("cobertura_nuvens_pct"),
        }
        
        features.append({
            "type": "Feature",
            "geometry": r["geometry"],
            "properties": props
        })
    
    return {"type": "FeatureCollection", "features": features}


def results_to_csv(talhoes_resultados: list) -> str:
    """Gera CSV com todas as métricas por talhão."""
    output = io.StringIO()
    
    fieldnames = [
        "id_talhao", "variedade", "area_ha", "estagio_desenvolvimento",
        "ndvi", "ndwi", "msi", "nmdi",
        "argila_pct", "areia_pct", "silte_pct", "textura_solo", "cad_norm",
        "elevacao_m", "declividade_graus", "declividade_pct", "twi",
        "ieh_value", "ieh_classe", "ieh_classe_num", "ieh_descricao",
        "data_imagem", "cobertura_nuvens_pct", "cena_sentinel2",
        "f_var_variedade"
    ]
    
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    
    for r in talhoes_resultados:
        row = {
            "id_talhao":            r.get("id_talhao", ""),
            "variedade":            r.get("variedade", ""),
            "area_ha":              r.get("area_ha", ""),
            "estagio_desenvolvimento": r.get("estagio_desenvolvimento", ""),
            "ndvi":                 r.get("indices", {}).get("ndvi", ""),
            "ndwi":                 r.get("indices", {}).get("ndwi", ""),
            "msi":                  r.get("indices", {}).get("msi", ""),
            "nmdi":                 r.get("indices", {}).get("nmdi", ""),
            "argila_pct":           r.get("solo", {}).get("argila_pct", ""),
            "areia_pct":            r.get("solo", {}).get("areia_pct", ""),
            "silte_pct":            r.get("solo", {}).get("silte_pct", ""),
            "textura_solo":         r.get("solo", {}).get("classificacao_textural", ""),
            "cad_norm":             r.get("cad_factor", ""),
            "elevacao_m":           r.get("terreno", {}).get("elevacao_media_m", ""),
            "declividade_graus":    r.get("terreno", {}).get("declividade_graus", ""),
            "declividade_pct":      r.get("terreno", {}).get("declividade_pct", ""),
            "twi":                  r.get("twi", ""),
            "ieh_value":            r.get("ieh_value", ""),
            "ieh_classe":           r.get("classe", ""),
            "ieh_classe_num":       r.get("classe_num", ""),
            "ieh_descricao":        r.get("descricao", ""),
            "data_imagem":          r.get("imagem", {}).get("data_imagem", ""),
            "cobertura_nuvens_pct": r.get("imagem", {}).get("cobertura_nuvens_pct", ""),
            "cena_sentinel2":       r.get("imagem", {}).get("id_cena", ""),
            "f_var_variedade":      r.get("componentes", {}).get("f_var", ""),
        }
        writer.writerow(row)
    
    return output.getvalue()


def get_summary_stats(talhoes_resultados: list) -> dict:
    """Calcula estatísticas resumo da análise (por classe IEH)."""
    total = len(talhoes_resultados)
    classes = {"Sem Estresse": [], "Estresse Leve": [], "Estresse Moderado": [], "Estresse Severo": [], "Erro": []}
    
    for r in talhoes_resultados:
        classe = r.get("classe", "Erro")
        if classe in classes:
            classes[classe].append(r.get("area_ha", 0) or 0)
        else:
            classes["Erro"].append(0)
    
    def cls_stats(key):
        items = classes[key]
        return {"count": len(items), "area_ha": round(sum(items), 2)}
    
    return {
        "total_talhoes": total,
        "area_total_ha": round(sum(r.get("area_ha", 0) or 0 for r in talhoes_resultados), 2),
        "sem_estresse":   cls_stats("Sem Estresse"),
        "estresse_leve":  cls_stats("Estresse Leve"),
        "estresse_moderado": cls_stats("Estresse Moderado"),
        "estresse_severo":   cls_stats("Estresse Severo"),
        "erros":          cls_stats("Erro"),
    }


def generate_pdf_report(talhoes_resultados: list, params: dict) -> bytes:
    """
    Gera relatório PDF profissional com ReportLab.
    Inclui: cabeçalho, tabela por talhão, gráfico de distribuição e legenda.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
    except ImportError:
        raise ImportError("reportlab não instalado. Execute: pip install reportlab")
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )
    
    styles = getSampleStyleSheet()
    story = []
    
    # Cores
    COR_VERDE   = colors.HexColor("#22c55e")
    COR_AMARELO = colors.HexColor("#eab308")
    COR_LARANJA = colors.HexColor("#f97316")
    COR_VERMELHO= colors.HexColor("#ef4444")
    COR_HEADER  = colors.HexColor("#1e3a5f")
    COR_CINZA   = colors.HexColor("#f1f5f9")
    
    def get_cor(classe):
        return {
            "Sem Estresse":     COR_VERDE,
            "Estresse Leve":    COR_AMARELO,
            "Estresse Moderado": COR_LARANJA,
            "Estresse Severo":  COR_VERMELHO,
        }.get(classe, colors.grey)
    
    # Título
    titulo_style = ParagraphStyle("titulo", parent=styles["Title"],
                                   fontSize=18, textColor=COR_HEADER, spaceAfter=4)
    subtitulo_style = ParagraphStyle("sub", parent=styles["Normal"],
                                      fontSize=10, textColor=colors.grey, spaceAfter=12)
    
    story.append(Paragraph("Relatório de Estresse Hídrico — Cana-de-Açúcar", titulo_style))
    story.append(Paragraph("AgroGIS NDB | Monitor de Estresse Hídrico via Sentinel-2", subtitulo_style))
    story.append(HRFlowable(width="100%", thickness=2, color=COR_HEADER))
    story.append(Spacer(1, 0.4*cm))
    
    # Parâmetros da análise
    data_relatorio = datetime.now().strftime("%d/%m/%Y %H:%M")
    info_data = [
        ["Data do Relatório:", data_relatorio],
        ["Período Analisado:", f"{params.get('start_date', '?')} a {params.get('end_date', '?')}"],
        ["Limite de Nuvens:", f"{params.get('cloud_threshold', 20)}%"],
        ["Total de Talhões:", str(len(talhoes_resultados))],
    ]
    t_info = Table(info_data, colWidths=[5*cm, 10*cm])
    t_info.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0,0), (0,-1), COR_HEADER),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 0.6*cm))
    
    # Estatísticas resumo
    stats = get_summary_stats(talhoes_resultados)
    story.append(Paragraph("Resumo por Classe de Estresse", styles["Heading2"]))
    
    resumo_data = [
        ["Classe", "Nº Talhões", "Área (ha)", "% da Área Total"],
        ["Sem Estresse",      stats["sem_estresse"]["count"],      f"{stats['sem_estresse']['area_ha']:.1f}", ""],
        ["Estresse Leve",     stats["estresse_leve"]["count"],     f"{stats['estresse_leve']['area_ha']:.1f}", ""],
        ["Estresse Moderado", stats["estresse_moderado"]["count"], f"{stats['estresse_moderado']['area_ha']:.1f}", ""],
        ["Estresse Severo",   stats["estresse_severo"]["count"],   f"{stats['estresse_severo']['area_ha']:.1f}", ""],
    ]
    area_total = stats["area_total_ha"]
    for i in range(1, 5):
        chave = ["sem_estresse", "estresse_leve", "estresse_moderado", "estresse_severo"][i-1]
        pct = (stats[chave]["area_ha"] / area_total * 100) if area_total > 0 else 0
        resumo_data[i][3] = f"{pct:.1f}%"
    
    t_resumo = Table(resumo_data, colWidths=[6*cm, 3*cm, 3*cm, 3*cm])
    cores_linhas = [COR_CINZA, COR_VERDE, COR_AMARELO, COR_LARANJA, COR_VERMELHO]
    t_style = [
        ("BACKGROUND", (0,0), (-1,0), COR_HEADER),
        ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
        ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",   (0,0), (-1,-1), 9),
        ("ALIGN",      (1,0), (-1,-1), "CENTER"),
        ("GRID",       (0,0), (-1,-1), 0.5, colors.lightgrey),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, COR_CINZA]),
    ]
    for i in range(1, 5):
        t_style.append(("BACKGROUND", (0,i), (0,i), cores_linhas[i]))
        t_style.append(("TEXTCOLOR",  (0,i), (0,i), colors.white))
    t_resumo.setStyle(TableStyle(t_style))
    story.append(t_resumo)
    story.append(Spacer(1, 0.8*cm))
    
    # Tabela detalhada por talhão
    story.append(Paragraph("Detalhamento por Talhão", styles["Heading2"]))
    
    header = ["Talhão", "Variedade", "Área\n(ha)", "NDVI", "NDWI", "MSI", "IEH", "Classe"]
    rows = [header]
    for r in talhoes_resultados:
        rows.append([
            r.get("id_talhao", "-"),
            r.get("variedade", "-"),
            f"{r.get('area_ha', 0):.1f}",
            f"{r.get('indices', {}).get('ndvi') or 0:.3f}",
            f"{r.get('indices', {}).get('ndwi') or 0:.3f}",
            f"{r.get('indices', {}).get('msi') or 0:.3f}",
            f"{r.get('ieh_value') or 0:.3f}",
            r.get("classe", "-"),
        ])
    
    col_widths = [2.5*cm, 3.5*cm, 1.8*cm, 1.8*cm, 1.8*cm, 1.8*cm, 1.8*cm, 3.5*cm]
    t_det = Table(rows, colWidths=col_widths, repeatRows=1)
    
    det_style = [
        ("BACKGROUND", (0,0), (-1,0), COR_HEADER),
        ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
        ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",   (0,0), (-1,-1), 8),
        ("ALIGN",      (2,0), (-1,-1), "CENTER"),
        ("GRID",       (0,0), (-1,-1), 0.3, colors.lightgrey),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, COR_CINZA]),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]
    for i, r in enumerate(talhoes_resultados, 1):
        cor = get_cor(r.get("classe", ""))
        det_style.append(("BACKGROUND", (-1, i), (-1, i), cor))
        det_style.append(("TEXTCOLOR",  (-1, i), (-1, i), colors.white))
    
    t_det.setStyle(TableStyle(det_style))
    story.append(t_det)
    story.append(Spacer(1, 1*cm))
    
    # Rodapé
    rodape_style = ParagraphStyle("rodape", parent=styles["Normal"],
                                   fontSize=8, textColor=colors.grey, alignment=TA_CENTER)
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        f"Relatório gerado automaticamente pelo AgroGIS NDB em {data_relatorio}. "
        f"Dados Sentinel-2 L2A via Microsoft Planetary Computer / Element84 Earth Search.",
        rodape_style
    ))
    
    doc.build(story)
    return buffer.getvalue()
