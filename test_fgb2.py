import geopandas as gpd
import os
print('Reading into Geopandas...')
gdf = gpd.read_file('temp_linhas.json')
gdf = gdf[gdf.geometry.notnull()]
print(f'Valid Rows: {len(gdf)}')
gdf.to_file('linhas_colheita.fgb', driver='FlatGeobuf')
size_mb = os.path.getsize('linhas_colheita.fgb') / 1024 / 1024
print(f'FGB size: {size_mb:.2f} MB')
