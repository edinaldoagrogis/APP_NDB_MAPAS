import os
import glob
import geopandas as gpd
from shapely import force_2d
import pandas as pd

def process_linhas():
    print("Processing LINHAS DE COLHEITA...")
    # Find all geojson files
    files = glob.glob(r'CAMADAS VETORIAIS\LINHAS DE COLHEITA\*.geojson')
    gdfs = []
    
    for f in files:
        print(f"Reading {f}...")
        try:
            gdf = gpd.read_file(f)
            # Filter empty and non-LineString if needed, though they should be lines
            gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
            gdfs.append(gdf)
        except Exception as e:
            print(f"Error reading {f}: {e}")
            
    if not gdfs:
        print("No data found.")
        return
        
    print("Concatenating all lines...")
    merged_gdf = pd.concat(gdfs, ignore_index=True)
    
    print("Flattening 3D geometries to 2D...")
    merged_gdf.geometry = force_2d(merged_gdf.geometry)
    
    print("Simplifying geometries (0.000005 deg)...")
    merged_gdf.geometry = merged_gdf.geometry.simplify(0.000005, preserve_topology=True)
    
    print("Saving to FlatGeobuf...")
    # Clean properties if needed
    if 'id' in merged_gdf.columns:
        merged_gdf = merged_gdf.drop(columns=['id'])
        
    merged_gdf.to_file('linhas_colheita.fgb', driver='FlatGeobuf')
    print("Finished! File size: ", os.path.getsize('linhas_colheita.fgb') / (1024*1024), "MB")

if __name__ == '__main__':
    process_linhas()
