import os
import json

def clean_properties(props, layer_type):
    new_props = {}
    
    if layer_type == 'FAZENDAS':
        # Para fazendas, precisamos de NOME, CODIGO e AREA_TOTAL
        for k, v in props.items():
            if v is None: continue
            k_upper = k.upper()
            if 'NAME' in k_upper or 'NOME' in k_upper or 'FAZENDA' in k_upper:
                if 'NOME_FAZ' not in new_props:
                    new_props['NOME_FAZ'] = str(v)
            if 'COD' in k_upper or 'ID' in k_upper:
                if 'CODIGO' not in new_props:
                    val_str = str(v)
                    if val_str.endswith('.0'):
                        val_str = val_str[:-2]
                    new_props['CODIGO'] = val_str
            if 'AREA' in k_upper or 'HECTARES' in k_upper:
                if 'AREA_TOTAL' not in new_props:
                    try:
                        new_props['AREA_TOTAL'] = round(float(v), 2)
                    except:
                        pass
        return new_props
        
    elif layer_type == 'TALHOES':
        for k, v in props.items():
            if v is None: continue
            k_upper = k.upper()
            
            # Prioritize COD_TALH over TALHAO for the block code
            if 'COD_TALH' in k_upper:
                try:
                    val = float(v)
                    new_props['COD_TALHAO'] = str(int(val)) if val.is_integer() else str(v)
                except:
                    new_props['COD_TALHAO'] = str(v).replace('.0', '') if str(v).endswith('.0') else str(v)
            elif 'TALHAO' in k_upper and 'COD_TALHAO' not in new_props and 'AREA' not in k_upper and 'TALH\ufffdO_\ufffd' not in k_upper:
                # avoid capturing TALHAO_ARE
                pass

            # Area
            if 'AREA' in k_upper and 'SHAPE' not in k_upper and 'AREAFAZEND' not in k_upper:
                try:
                    new_props['AREA'] = round(float(v), 2)
                except:
                    pass
            elif 'TALH\ufffdO_\ufffd' in k_upper or 'TALHO_' in k_upper:
                if 'AREA' not in new_props:
                    try:
                        new_props['AREA'] = round(float(v), 2)
                    except:
                        pass
                    
            # Variedade
            if 'VARIEDADE' in k_upper:
                new_props['VARIEDADE'] = str(v)
                
            # Corte
            if 'CORTE' in k_upper and 'RECORT' not in k_upper:
                new_props['CORTE'] = str(v)
                
            # Nome Fazenda
            if 'NOMEPROPRI' in k_upper or 'NOME_FAZ' in k_upper or 'DESCFUNDOA' in k_upper:
                if 'NOME_FAZ' not in new_props:
                    new_props['NOME_FAZ'] = str(v)
                    
            # Add COD_TALHAO fallback if not found yet but TALHAO is there
            if 'TALHAO' in k_upper and 'COD_TALHAO' not in new_props and 'AREA' not in k_upper:
                 try:
                     val = float(v)
                     new_props['COD_TALHAO'] = str(int(val)) if val.is_integer() else str(v)
                 except:
                     new_props['COD_TALHAO'] = str(v).replace('.0', '') if str(v).endswith('.0') else str(v)
                 
    return new_props

def round_coords(coords, decimals=5):
    if isinstance(coords, list):
        if len(coords) == 2 and isinstance(coords[0], (int, float)):
            return [round(coords[0], decimals), round(coords[1], decimals)]
        return [round_coords(c, decimals) for c in coords]
    return coords

import glob

def optimize_geojson_paths(input_paths, layer_type):
    merged_data = {"type": "FeatureCollection", "name": layer_type, "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } }, "features": []}
    
    for path in input_paths:
        if not os.path.exists(path):
            continue
        print(f"Loading {path}...")
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            data = json.load(f)
            
        print(f"Original features in {path}: {len(data.get('features', []))}")
        
        for feature in data.get('features', []):
            feature['properties'] = clean_properties(feature.get('properties', {}), layer_type)
            if layer_type == 'LINHAS DE COLHEITA':
                feature['geometry']['coordinates'] = round_coords(feature['geometry']['coordinates'], decimals=8)
            else:
                feature['geometry']['coordinates'] = round_coords(feature['geometry']['coordinates'], decimals=5)
            
            merged_data['features'].append(feature)
            
    return merged_data

def build():
    fazendas_paths = [os.path.join('CAMADAS VETORIAIS', 'FAZENDAS_01.geojson')]
    talhoes_paths = [os.path.join('CAMADAS VETORIAIS', 'TALHOES_01.geojson')]
    
    linhas_colheita_paths = [os.path.join('CAMADAS VETORIAIS', 'LINHAS DE COLHEITA.geojson')]
    linhas_colheita_paths.extend(glob.glob(os.path.join('CAMADAS VETORIAIS', 'LINHAS DE COLHEITA', '*.geojson')))
    
    opt_faz_data = optimize_geojson_paths(fazendas_paths, 'FAZENDAS')
    opt_faz_json_str = json.dumps(opt_faz_data, separators=(',', ':')) if opt_faz_data['features'] else 'null'
        
    opt_tal_data = optimize_geojson_paths(talhoes_paths, 'TALHOES')
    opt_tal_json_str = json.dumps(opt_tal_data, separators=(',', ':')) if opt_tal_data['features'] else 'null'

    opt_linhas_col_data = optimize_geojson_paths(linhas_colheita_paths, 'LINHAS DE COLHEITA')
    opt_linhas_col_json_str = "null"
    
    # NEW FGB CONVERSION
    try:
        import geopandas as gpd
        import warnings
        warnings.filterwarnings('ignore', 'GeoSeries.notna', UserWarning)
        print("Converting LINHAS DE COLHEITA to FlatGeobuf...")
        if opt_linhas_col_data['features']:
            import tempfile
            with tempfile.NamedTemporaryFile('w', delete=False, suffix='.json') as tmp:
                json.dump(opt_linhas_col_data, tmp)
                tmp_name = tmp.name
            
            gdf = gpd.read_file(tmp_name)
            gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
            gdf.to_file('linhas_colheita.fgb', driver='FlatGeobuf')
            os.remove(tmp_name)
            print("Successfully created linhas_colheita.fgb")
    except Exception as e:
        print(f"Error creating FGB: {e}")

        
    try:
        with open('layers_data.json', 'w', encoding='utf-8') as out_json:
            json_obj = {
                "FAZENDAS": opt_faz_data if opt_faz_data['features'] else None,
                "TALHOES": opt_tal_data if opt_tal_data['features'] else None,
                "LINHAS DE COLHEITA": None,
                "VARIEDADES": None
            }
            json.dump(json_obj, out_json)
        print("Successfully created layers_data.json for importing!")
    except Exception as e:
        print(f"Error creating layers_data.json: {e}")

    with open('layers_data.js', 'w', encoding='utf-8') as out:
        out.write('const GEOPORTAL_LAYERS = {\n')
        out.write(f'  "FAZENDAS": {opt_faz_json_str},\n')
        out.write(f'  "TALHOES": {opt_tal_json_str},\n')
        out.write(f'  "LINHAS DE COLHEITA": {opt_linhas_col_json_str},\n')
        out.write('  "VARIEDADES": null\n')
        out.write('};\n\n')
        out.write('const EQUIPES_DATA = [];\n\n')
        out.write('const APP_VERSION = "v112";\n')

if __name__ == '__main__':
    build()
    print("layers_data.js rebuilt and super-optimized!")
