import os
import glob
import zipfile
import tempfile
import shutil
import geopandas as gpd
from shapely import force_2d
import pandas as pd
import warnings

warnings.filterwarnings('ignore')

def process_linhas():
    folder = os.path.join('CAMADAS VETORIAIS', 'LINHAS DE COLHEITA')
    main_zip = os.path.join(folder, 'LINHAS BEMAGRO_01.zip')
    
    if not os.path.exists(main_zip):
        print(f"File not found: {main_zip}")
        return

    # 1. Remove old files in folder except LINHAS BEMAGRO_01.zip
    print("Cleaning old files in LINHAS DE COLHEITA...")
    for item in os.listdir(folder):
        item_path = os.path.join(folder, item)
        if item != 'LINHAS BEMAGRO_01.zip':
            try:
                if os.path.isfile(item_path) or os.path.islink(item_path):
                    os.unlink(item_path)
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
            except Exception as e:
                print(f"Failed to delete {item_path}: {e}")

    # 2. Extract and read inner zips from LINHAS BEMAGRO_01.zip
    gdfs = []
    temp_dir = tempfile.mkdtemp()
    try:
        print(f"Extracting {main_zip}...")
        with zipfile.ZipFile(main_zip, 'r') as z:
            z.extractall(temp_dir)
            
        inner_zips = []
        for root, dirs, files in os.walk(temp_dir):
            for f in files:
                if f.lower().endswith('.zip'):
                    inner_zips.append(os.path.join(root, f))
                    
        print(f"Found {len(inner_zips)} inner zip files.")
        
        for idx, iz in enumerate(sorted(inner_zips), 1):
            base_name = os.path.basename(iz)
            try:
                # Extract inner zip to its own subdir to inspect files
                sub_extract = os.path.join(temp_dir, f"inner_{idx}")
                os.makedirs(sub_extract, exist_ok=True)
                with zipfile.ZipFile(iz, 'r') as inner_z:
                    inner_z.extractall(sub_extract)
                
                # Find .shp file (prefer LINHAS.shp if multiple exist)
                shp_files = glob.glob(os.path.join(sub_extract, '**', '*.shp'), recursive=True)
                if not shp_files:
                    print(f"[{idx}/{len(inner_zips)}] No .shp in {base_name}")
                    continue
                
                # Check if there is one named LINHAS
                linhas_shps = [s for s in shp_files if 'LINHAS' in os.path.basename(s).upper()]
                target_shp = linhas_shps[0] if linhas_shps else shp_files[0]
                
                gdf = gpd.read_file(target_shp)
                if gdf.crs and gdf.crs.to_epsg() != 4326:
                    gdf = gdf.to_crs(epsg=4326)
                
                gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()]
                
                # Also save individual geojson in folder if needed, or keep in memory
                out_geojson = os.path.join(folder, f"{os.path.splitext(base_name)[0]}.geojson")
                gdf.to_file(out_geojson, driver="GeoJSON")
                
                gdfs.append(gdf)
                print(f"[{idx}/{len(inner_zips)}] Processed {base_name} ({len(gdf)} features)")
            except Exception as e:
                print(f"[{idx}/{len(inner_zips)}] Error reading {base_name}: {e}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    if not gdfs:
        print("No valid geometries found!")
        return

    print(f"Concatenating {len(gdfs)} datasets...")
    merged_gdf = pd.concat(gdfs, ignore_index=True)
    print(f"Total features: {len(merged_gdf)}")

    print("Flattening 3D geometries to 2D...")
    merged_gdf.geometry = force_2d(merged_gdf.geometry)

    print("Simplifying geometries (0.000005 deg)...")
    merged_gdf.geometry = merged_gdf.geometry.simplify(0.000005, preserve_topology=True)

    if 'id' in merged_gdf.columns:
        merged_gdf = merged_gdf.drop(columns=['id'])

    print("Saving to linhas_colheita.fgb...")
    merged_gdf.to_file('linhas_colheita.fgb', driver='FlatGeobuf')
    size_mb = os.path.getsize('linhas_colheita.fgb') / (1024 * 1024)
    print(f"Finished! File size: {size_mb:.2f} MB")

    # Also copy to PWA folder if it exists
    pwa_fgb = r'ARQUIVO_INSTALAÇÃO\IOS\PWA_01\APP_AGROGIS_PWA\linhas_colheita.fgb'
    if os.path.exists(os.path.dirname(pwa_fgb)):
        shutil.copy2('linhas_colheita.fgb', pwa_fgb)
        print("Copied to PWA directory.")

if __name__ == '__main__':
    process_linhas()
