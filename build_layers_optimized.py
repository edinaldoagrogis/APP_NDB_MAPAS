import os
import json

def clean_properties(props, layer_type):
    new_props = {}
    
    if layer_type == 'FAZENDAS':
        # Para fazendas, apenas Name importa
        for k, v in props.items():
            if v is None: continue
            if 'NAME' in k.upper():
                new_props['NAME'] = str(v)
                return new_props
        return props
        
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

def optimize_geojson(input_path, layer_type):
    print(f"Loading {input_path}...")
    with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
        data = json.load(f)
        
    print(f"Original features in {layer_type}: {len(data['features'])}")
    
    for feature in data['features']:
        feature['properties'] = clean_properties(feature.get('properties', {}), layer_type)
        feature['geometry']['coordinates'] = round_coords(feature['geometry']['coordinates'])
        
    return data

def build():
    fazendas_path = os.path.join('CAMADAS VETORIAIS', 'FAZENDAS_01.geojson')
    talhoes_path = os.path.join('CAMADAS VETORIAIS', 'TALHOES_01.geojson')
    
    if os.path.exists(fazendas_path):
        opt_faz_data = optimize_geojson(fazendas_path, 'FAZENDAS')
        opt_faz_json_str = json.dumps(opt_faz_data, separators=(',', ':'))
    else:
        opt_faz_json_str = 'null'
        
    if os.path.exists(talhoes_path):
        opt_tal_data = optimize_geojson(talhoes_path, 'TALHOES')
        opt_tal_json_str = json.dumps(opt_tal_data, separators=(',', ':'))
    else:
        opt_tal_json_str = 'null'
        
    with open('layers_data.js', 'w', encoding='utf-8') as out:
        out.write('const GEOPORTAL_LAYERS = {\n')
        out.write(f'  "FAZENDAS": {opt_faz_json_str},\n')
        out.write(f'  "TALHOES": {opt_tal_json_str},\n')
        out.write('  "VARIEDADES": null\n')
        out.write('};\n\n')
        out.write('const EQUIPES_DATA = [];\n\n')
        out.write('const APP_VERSION = "v111";\n')

if __name__ == '__main__':
    build()
    print("layers_data.js rebuilt and super-optimized!")
