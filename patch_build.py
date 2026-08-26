with open('build_layers_optimized.py', 'r', encoding='utf-8') as f:
    text = f.read()

# We need to add the import geopandas and the conversion logic inside uild()
replacement = '''    opt_linhas_col_json_str = "null"
    
    # NEW FGB CONVERSION
    try:
        import geopandas as gpd
        import warnings
        warnings.filterwarnings('ignore', 'GeoSeries.notna', UserWarning)
        print("Converting LINHAS DE COLHEITA to FlatGeobuf...")
        if opt_linhas_col_data['features']:
            import json
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
'''
text = text.replace("    opt_linhas_col_json_str = json.dumps(opt_linhas_col_data, separators=(',', ':')) if opt_linhas_col_data['features'] else 'null'", replacement)

with open('build_layers_optimized.py', 'w', encoding='utf-8') as out:
    out.write(text)
