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
            
        out.write(',\n  "TALHOES": ')
        
        # TALHOES
        if os.path.exists('TALHOES.geojson'):
            with open('TALHOES.geojson', 'r', encoding='utf-8') as f:
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

if __name__ == '__main__':
    build_layers()
    print("layers_data.js rebuilt successfully.")
