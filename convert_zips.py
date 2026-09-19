import os
import glob
import geopandas as gpd

folder = os.path.join('CAMADAS VETORIAIS', 'LINHAS DE COLHEITA')
zips = glob.glob(os.path.join(folder, '*.zip'))

for zip_path in zips:
    base = os.path.splitext(os.path.basename(zip_path))[0]
    out_path = os.path.join(folder, f"{base}.geojson")
    if not os.path.exists(out_path):
        print(f"Converting {zip_path} to {out_path}...")
        try:
            gdf = gpd.read_file(f"zip://{zip_path}")
            # Ensure it's WGS84
            if gdf.crs and gdf.crs.to_epsg() != 4326:
                gdf = gdf.to_crs(epsg=4326)
            gdf.to_file(out_path, driver="GeoJSON")
            print(f"Converted {base}.zip")
        except Exception as e:
            print(f"Error converting {zip_path}: {e}")
