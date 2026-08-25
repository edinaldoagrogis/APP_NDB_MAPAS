from flask import Flask, request, jsonify
from flask_cors import CORS
import geopandas as gpd
import json
import os
from gerador_mapa_catacao import generate_grid, fetch_sentinel2_ndvi, unary_union, get_utm_crs

app = Flask(__name__)
CORS(app)  # Permite que o frontend da Vercel chame esta API

@app.route('/api/processar-catacao', methods=['POST'])
def processar_catacao():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Nenhum dado GeoJSON enviado"}), 400
            
        # 1. Carrega o GeoJSON enviado pelo Frontend
        gdf_talhao = gpd.GeoDataFrame.from_features(data["features"])
        gdf_talhao.set_crs(epsg=4326, inplace=True)
        
        grid_size = 40 # Tamanho em metros
        threshold = 0.55
        
        # 2. Gera a grade de 40x40m
        grid_gdf = generate_grid(gdf_talhao, grid_size_meters=grid_size)
        
        # 3. CONEXÃO SENTINEL-2 (STAC/API)
        grid_analisada = fetch_sentinel2_ndvi(grid_gdf)
        
        # 4. Aplica Limite / Threshold
        grid_infestada = grid_analisada[grid_analisada['ndvi_mean'] > threshold]
        
        if len(grid_infestada) == 0:
            return jsonify({"type": "FeatureCollection", "features": [], "area_total_ha": 0})
            
        # 5. Dissolve / Merge
        merged_geom = unary_union(grid_infestada.geometry)
        merged_gdf = gpd.GeoDataFrame({'geometry': [merged_geom]}, crs='EPSG:4326')
        
        # 6. Clip pelo limite do talhão original
        catacao_final = gpd.overlay(merged_gdf, gdf_talhao, how='intersection')
        
        # 7. Adiciona atributos e calcula área
        catacao_final['TIPO'] = 'Área de Catação'
        area_ha = catacao_final.to_crs(epsg=get_utm_crs(catacao_final.centroid.x[0], catacao_final.centroid.y[0])).area.sum() / 10000
        catacao_final['AREA_HA'] = area_ha
        
        # 8. Retorna para o Frontend o GeoJSON com a área!
        result_json = json.loads(catacao_final.to_json())
        result_json['area_total_ha'] = area_ha
        
        return jsonify(result_json)

    except Exception as e:
        print(f"Erro na API: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Iniciando API do AgroGIS (Backend de Catação)...")
    # Roda a API local na porta 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
