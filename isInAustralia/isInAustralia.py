import sys
import geopandas as gpd
from shapely.geometry import Point
import json
import os


country_shapefile = ""


def point_in_bounding_box(lat, lon):
    """
    Checks if the given latitude and longitude fall within the rough bounding box
    defined by the four extreme points of Australian territory.
    
    Extreme points:
      - West (Cocos Keeling):     (-12.155521, 96.812627)
      - North (Stephens Inlet):    (-9.504140, 143.544493)
      - East (Norfolk Island):     (-29.041823, 168.003044)
      - South (MacDonald Island):  (-53.195662, 73.566420)
      
    Note: The bounding box is computed from the minimum and maximum latitudes and longitudes.
    """
    # Define the extreme points as (latitude, longitude)
    extremes = {
        "Cocos_Keeling": (-12.155521, 96.812627),
        "Stephens_Inlet": (-9.504140, 143.544493),
        "Norfolk_Island": (-29.041823, 168.003044),
        "MacDonald_Island": (-53.195662, 73.566420)
    }
    
    #comms
    # Extract latitudes and longitudes
    lats = [pt[0] for pt in extremes.values()]
    lons = [pt[1] for pt in extremes.values()]
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)
    
    # Quick bounding box test
    if (min_lat <= lat <= max_lat) and (min_lon <= lon <= max_lon):
        return True
    return False

def is_point_in_australia(lat, lon, country_shapefile_path):
    """
    Determines whether the given point (lat, lon) falls on Australian territory.
    The check first uses a rough bounding box, and if that passes, loads the simplified
    shapefile (containing 100 polygons) to test if the point is within any polygon.
    
    Parameters:
      lat, lon: Latitude and longitude (in degrees, EPSG:4326)
      shapefile_path: Path to the simplified Australian territory shapefile.
      
    Returns:
      True if the point is on Australian territory, False otherwise.
    """
    # First check: is the point within the overall bounding box?
    if not point_in_bounding_box(lat, lon):
        print("The point is outside the rough bounding box of Australian territory.", file=sys.stderr)
        return False
    print("The point is within the rough bounding box of Australian territory.", file=sys.stderr)
    # Create the point. Note: Shapely (and GeoPandas) expect (x, y) = (lon, lat)
    point = Point(lon, lat)
    
    # Load the simplified shapefile
    
    gdf = gpd.read_file(country_shapefile_path)
    print(f"From python function Shapefile CRS: {gdf.crs} :: {country_shapefile_path}", file=sys.stderr)
    
    # If the shapefile's CRS is not EPSG:4326, reproject the point to the shapefile's CRS.
    if gdf.crs and gdf.crs.to_string() != "EPSG:4326":
        point = gpd.GeoSeries([point], crs="EPSG:4326").to_crs(gdf.crs).iloc[0]
    
    # Check if the point is inside any polygon in the shapefile
    for geom in gdf.geometry:
        # Skip invalid or empty geometries
        if geom is None:
            continue
        if geom.contains(point):
            return True
    return False

if len(sys.argv) != 3:
    print("isInAustralia error Usage: script.py <latitude> <longitude>", file=sys.stderr)
    sys.exit(1)

# The following lines should not be indented further
lat = float(sys.argv[1])  # Convert latitude to float
lon = float(sys.argv[2])  # Convert longitude to float
# lets make a global variable for the shapefile path

script_dir = os.path.dirname(__file__)
shapefile_path = os.path.join(script_dir, 'AUS_2021_AUST_SHP_GDA2020/AUS_2021_AUST_GDA2020.shp')
print(f"shapefile_path Joined:  + {shapefile_path}", file=sys.stderr)

print(f"isInAustralia request from python: Latitude: {lat}, Longitude: {lon}, shape file path{shapefile_path}", file=sys.stderr)
result = is_point_in_australia(lat, lon, shapefile_path)
print(f"isInAustralia request response:  + {result}", file=sys.stderr)
print(json.dumps(result))  # Serialize and print the result as a JSON string


