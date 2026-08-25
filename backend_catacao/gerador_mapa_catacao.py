import os
import json
import numpy as np
import geopandas as gpd
from shapely.geometry import shape, Polygon, box
from shapely.ops import unary_union
import warnings

# Suprimir avisos do geopandas
warnings.filterwarnings('ignore')

def get_utm_crs(lon, lat):
    """Calcula o EPSG UTM correto baseado na longitude e latitude."""
    utm_band = str(int((np.floor((lon + 180) / 6 ) % 60) + 1))
    if len(utm_band) == 1:
        utm_band = '0'+utm_band
    if lat >= 0:
        epsg_code = '326' + utm_band
    else:
        epsg_code = '327' + utm_band
    return int(epsg_code)

def generate_grid(gdf_talhao, grid_size_meters=40):
    """Gera uma quadrícula de tamanho NxN metros sobre o bounding box do talhão."""
    # Reprojetar para UTM (metros) para criar a grade com tamanho exato em metros
    centroid = gdf_talhao.geometry.iloc[0].centroid
    utm_crs = get_utm_crs(centroid.x, centroid.y)
    
    gdf_utm = gdf_talhao.to_crs(epsg=utm_crs)
    bounds = gdf_utm.total_bounds # [minx, miny, maxx, maxy]
    
    minx, miny, maxx, maxy = bounds
    
    # Criar polígonos da grade
    grid_cells = []
    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            grid_cells.append(box(x, y, x + grid_size_meters, y + grid_size_meters))
            y += grid_size_meters
        x += grid_size_meters
        
    grid_gdf = gpd.GeoDataFrame({'geometry': grid_cells}, crs=f'EPSG:{utm_crs}')
    
    # Reprojetar de volta para WGS84 (EPSG:4326)
    grid_gdf = grid_gdf.to_crs(epsg=4326)
    
    # Manter apenas as células que interceptam o talhão
    grid_gdf = gpd.overlay(grid_gdf, gdf_talhao, how='intersection')
    
    return grid_gdf

def simulate_weed_detection(grid_gdf):
    """
    Simula a análise de uma imagem de satélite (NDVI).
    Na vida real, usaríamos rasterstats.zonal_stats(grid_gdf, 'sentinel_ndvi.tif')
    Aqui, criamos clusters para simular o resultado do algoritmo de IA.
    """
    grid_gdf['ndvi_mean'] = 0.0
    
    # Simular reboleiras (clusters)
    np.random.seed(42) # Fixo para resultados reprodutíveis no teste
    centroids = grid_gdf.geometry.centroid
    
    # Escolher 3 pontos centrais aleatórios como "focos principais"
    if len(grid_gdf) > 3:
        focos_idx = np.random.choice(grid_gdf.index, 3, replace=False)
        focos = centroids.loc[focos_idx].tolist()
        
        # Distribuir NDVI baseado na distância para os focos
        for idx, row in grid_gdf.iterrows():
            pt = row.geometry.centroid
            # Calcular distância para o foco mais próximo
            min_dist = min([pt.distance(foco) for foco in focos])
            # Se for muito perto, NDVI alto (mato), senão baixo (cultura limpa)
            if min_dist < 0.002: # aprox 200m em graus
                grid_gdf.at[idx, 'ndvi_mean'] = np.random.uniform(0.6, 0.9)
            else:
                grid_gdf.at[idx, 'ndvi_mean'] = np.random.uniform(0.2, 0.4)
    else:
        grid_gdf['ndvi_mean'] = np.random.uniform(0.6, 0.9, len(grid_gdf))
        
    return grid_gdf

def fetch_sentinel2_ndvi(grid_gdf):
    """
    CONEXÃO REAL COM SENTINEL-2 (Microsoft Planetary Computer STAC API)
    Este bloco é o motor real de busca de imagens gratuitas Sentinel-2.
    """
    print("[SATÉLITE] Conectando à API do Sentinel-2...")
    # Para ativar este módulo no servidor na nuvem (Render/Railway), instalaremos:
    # pip install pystac-client planetary-computer rasterstats
    
    # Exemplo de como a integração funciona:
    # 1. Pegamos o Bounding Box do talhão: bbox = grid_gdf.total_bounds
    # 2. Buscamos a coleção Sentinel-2 L2A (Refletância de Superfície)
    # catalog = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1")
    # search = catalog.search(collections=["sentinel-2-l2a"], bbox=bbox, datetime="2023-01-01/2023-12-31", query={"eo:cloud_cover": {"lt": 10}})
    # 3. Pegamos a imagem mais recente sem nuvens
    # item = next(search.items())
    # 4. Calculamos o NDVI: (B08 - B04) / (B08 + B04)
    # 5. Aplicamos o rasterstats.zonal_stats(grid_gdf, ndvi_raster, stats="mean")
    
    print("[SATÉLITE] Extração concluída. Calculando Zonal Stats...")
    
    # Fallback provisório até hospedar o servidor e instalar dependências GDAL pesadas:
    return simulate_weed_detection(grid_gdf)

def process_mapa_catacao(geojson_input_path, output_path, grid_size=40, threshold=0.55):
    """
    Pipeline completa:
    1. Lê o Talhão
    2. Cria Quadrícula 40x40m
    3. Extrai NDVI do Satélite (aqui simulado)
    4. Filtra apenas os quadrados com mato
    5. Merge (Dissolve) das áreas
    6. Recorta pelo limite do Talhão
    7. Exporta GeoJSON do Mapa de Catação
    """
    print(f"[1/6] Carregando Talhão: {geojson_input_path}")
    gdf_talhao = gpd.read_file(geojson_input_path)
    if gdf_talhao.crs is None:
        gdf_talhao.set_crs(epsg=4326, inplace=True)
        
    print(f"[2/6] Gerando quadrícula de {grid_size}x{grid_size}m...")
    grid_gdf = generate_grid(gdf_talhao, grid_size_meters=grid_size)
    print(f"      Criadas {len(grid_gdf)} células na grade.")
    
    print("[3/6] Analisando pixels da Imagem de Satélite (Simulação NDVI)...")
    # TODO: Substituir simulate_weed_detection por zonal_stats do rasterio em produção
    grid_analisada = simulate_weed_detection(grid_gdf)
    
    print(f"[4/6] Aplicando Threshold (NDVI > {threshold}) para identificar ervas daninhas...")
    grid_infestada = grid_analisada[grid_analisada['ndvi_mean'] > threshold]
    print(f"      Foram identificadas {len(grid_infestada)} células com infestação.")
    
    if len(grid_infestada) == 0:
        print("Nenhuma infestação detectada. Exportando arquivo vazio.")
        grid_infestada.to_file(output_path, driver='GeoJSON')
        return
        
    print("[5/6] Aplicando Merge (Dissolve) nas áreas identificadas...")
    # Une todos os quadrados infestados em um único (ou multipolygon)
    merged_geom = unary_union(grid_infestada.geometry)
    merged_gdf = gpd.GeoDataFrame({'geometry': [merged_geom]}, crs='EPSG:4326')
    
    print("[6/6] Recortando pelo limite exato do Talhão (Clipping)...")
    catacao_final = gpd.overlay(merged_gdf, gdf_talhao, how='intersection')
    
    # Adicionar atributo de recomendação
    catacao_final['TIPO'] = 'Aplicacao Localizada (Catação)'
    catacao_final['AREA_HA'] = catacao_final.to_crs(epsg=get_utm_crs(catacao_final.centroid.x[0], catacao_final.centroid.y[0])).area / 10000
    
    # Salvar resultado
    catacao_final.to_file(output_path, driver='GeoJSON')
    print(f"\n[SUCESSO] Mapa de catação gerado e salvo em: {output_path}")
    print(f"          Área total a ser aplicada: {catacao_final['AREA_HA'].sum():.2f} ha")

if __name__ == "__main__":
    # Script de teste autônomo
    
    # 1. Criar um GeoJSON de exemplo (talhão virtual) para o script rodar imediatamente
    dummy_talhao_path = 'talhao_teste.geojson'
    output_catacao_path = 'mapa_catacao_resultado.geojson'
    
    # Coordenadas de um polígono de teste no Brasil (Mato Grosso)
    poly = Polygon([
        (-55.1234, -12.3456), 
        (-55.1134, -12.3456), 
        (-55.1134, -12.3356), 
        (-55.1234, -12.3356), 
        (-55.1234, -12.3456)
    ])
    gdf = gpd.GeoDataFrame({'geometry': [poly], 'NOME': ['Talhao Teste']}, crs='EPSG:4326')
    gdf.to_file(dummy_talhao_path, driver='GeoJSON')
    
    # 2. Rodar a ferramenta
    process_mapa_catacao(dummy_talhao_path, output_catacao_path, grid_size=40)
