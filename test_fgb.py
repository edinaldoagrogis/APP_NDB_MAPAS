import geopandas as gpd
import json
import os

print('Loading 11MB geojson...')
with open('layers_data.js', 'r', encoding='utf-8') as f:
    text = f.read()
    import re
    matches = re.finditer(r'\"LINHAS DE COLHEITA\":\s*(\{\"type\":\"FeatureCollection\"[\s\S]*?(?=\,\s*\"[A-Z_ ]+\":|\}\s*;\s*const))', text)
    for m in matches:
        with open('temp_linhas.json', 'w', encoding='utf-8') as out:
            out.write(m.group(1))

print('Reading into Geopandas...')
gdf = gpd.read_file('temp_linhas.json')
print(f'Rows: {len(gdf)}')

print('Saving to FGB...')
gdf.to_file('linhas_colheita.fgb', driver='FlatGeobuf')
print(f'FGB size: {os.path.getsize("linhas_colheita.fgb")} bytes')
