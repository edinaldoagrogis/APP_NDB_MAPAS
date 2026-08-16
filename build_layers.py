import os

def build_layers():
    with open('layers_data.js', 'w', encoding='utf-8') as out:
        out.write('const GEOPORTAL_LAYERS = {\n')
        
        # FAZENDAS
        out.write('  "FAZENDAS": ')
        if os.path.exists('FAZENDAS.geojson'):
            with open('FAZENDAS.geojson', 'r', encoding='utf-8') as f:
                out.write(f.read())
        else:
            out.write('null')
            
        out.write(',\n  "VARIEDADES": ')
        
        # VARIEDADES
        if os.path.exists('VARIEDADES.geojson'):
            with open('VARIEDADES.geojson', 'r', encoding='utf-8') as f:
                out.write(f.read())
        else:
            out.write('null')
            
        out.write('\n};\n')
        
        out.write('// Duplicate FAZENDAS layer into TALHOES since user exported same geometries\n')
        out.write('GEOPORTAL_LAYERS["TALHOES"] = GEOPORTAL_LAYERS["FAZENDAS"];\n\n')
        out.write('const EQUIPES_DATA = [];\n\n')
        out.write('const APP_VERSION = "v108";\n')

if __name__ == '__main__':
    build_layers()
    print("layers_data.js rebuilt successfully (optimized!).")
