import geopandas as gpd
from shapely.geometry import Point, MultiPolygon
from shapely.ops import nearest_points
from pyproj import Transformer
import datetime
import simplekml
import time
import math
import json
import sys
import os

sys.path.insert(1, "../Tools/")
from dea_tools.plotting import display_map
from dea_tools.waterbodies import (
    get_waterbodies
)
    
def load_shapefile(shapefile_path):
    print(f"Loading shapefile: {shapefile_path}", file=sys.stderr)
    return gpd.read_file(shapefile_path)

def transform_point(lat, lon, source_crs='EPSG:4326', target_crs='EPSG:3577'):
    # Create a transformer to convert the point to the target CRS
    transformer = Transformer.from_crs(source_crs, target_crs, always_xy=True)
    x, y = transformer.transform(lon, lat)
    return Point(x, y)

def inland_water_proximity_and_location_DEA_Tools(lat, lon, bbxSize=20):
    # Transform the input lat, lon into the appropriate CRS to match water bodies
    point = transform_point(lat, lon, 'EPSG:4326', 'EPSG:3577')  # Assuming transform_point does CRS transformation

    factor = 0
    while True:
        current_size = bbxSize * (1 + factor)
        bbox = calculate_bounding_box(lat, lon, current_size)
        print(f"Current Bounding Box Size: {current_size}, Bounding Box: {bbox}", file=sys.stderr)

        # Fetch water bodies within the bounding box
        waterbodies = get_waterbodies(bbox, crs="EPSG:4326")
        #print(f"Number of water bodies: {len(waterbodies)}")

        if not waterbodies.empty:
            #print("Water bodies found. Processing...")
            waterbodies = gpd.GeoDataFrame(waterbodies, geometry='geometry', crs="EPSG:3577")

            # Calculate distance in transformed CRS for accuracy
            waterbodies['distance'] = waterbodies.distance(point)
            closest_body_index = waterbodies['distance'].idxmin()
            closest_body = waterbodies.iloc[closest_body_index]

            # Find the closest point on the closest water body to the transformed point
            nearest_geom = nearest_points(point, closest_body.geometry)
            closest_point = nearest_geom[1]
            closest_point_tx = transform_point(closest_point.y, closest_point.x, 'EPSG:3577', 'EPSG:4326')

            # Calculate distance in meters (make sure both points are in a CRS that measures distance in meters)
            distance_to_closest_point = point.distance(closest_point)/1000

            # Print and return the transformed closest point coordinates and distance
            closest_point_lat = closest_point_tx.y
            closest_point_lon = closest_point_tx.x
            print(f"Closest Point on Water Body: {closest_point_lat}, {closest_point_lon}", file=sys.stderr)
            print(f"Distance to Closest Point: {distance_to_closest_point} meters", file=sys.stderr)
            
            result = {
                "distance": distance_to_closest_point,
                "closest_point": {
                "lat": closest_point_lat,
                "lon": closest_point_lon
                }
            }
            return result
        factor += 5


def coastal_water_proximity_and_location(lat, lon, coastal_shapes):
    """
    Calculate the nearest distance from the point to the coastal boundary of the shapefile.
    Checks if the point is inside any shape and then finds the closest point on the boundary.
    """

    # Transform the point from WGS 84 (EPSG:4326) to Web Mercator (EPSG:3857)
    transformer = Transformer.from_crs('EPSG:4326', 'EPSG:3857', always_xy=True)
    x, y = transformer.transform(lon, lat)
    point = Point(x, y)

    # Initialize variables to find the nearest coastal boundary
    min_distance = float('inf')
    closest_point_on_coast = None

    # Iterate through each coastal shape to find if the point is inside one
    for shape in coastal_shapes.geometry:
        # Check if the point is inside this particular shape
        if shape.contains(point):
            # Calculate the nearest point on the boundary of this shape to the given point
            boundary = shape.boundary
            nearest_point = nearest_points(point, boundary)[1]
            distance = point.distance(nearest_point)
            # Update the minimum distance if the current one is smaller
            if distance < min_distance:
                min_distance = distance
                closest_point_on_coast = nearest_point
            break  # Exit the loop if we have found the point is inside a shape

    # Convert the nearest coastal point back to standard latitude and longitude
    if closest_point_on_coast:
        lon_lat_transformer = Transformer.from_crs('EPSG:3857', 'EPSG:4326', always_xy=True)
        lon, lat = lon_lat_transformer.transform(closest_point_on_coast.x, closest_point_on_coast.y)
        min_distance = min_distance/1000
        result = {
                "distance": min_distance,
                "closest_point": {
                "lat": lat,
                "lon": lon
                }
            }
        return result
    else:
        return {}  # Return None if the point is not inside any coastal area


def calculate_bounding_box(latitude, longitude, distance_km):
    # Constants
    km_per_degree = 111.32  # Approximate km per degree latitude
    lat_change = distance_km / km_per_degree
    lon_change = distance_km / (km_per_degree * math.cos(math.radians(latitude)))

    # Bounding Box Limits
    min_lat = latitude - lat_change
    max_lat = latitude + lat_change
    min_lon = longitude - lon_change
    max_lon = longitude + lon_change

    return (min_lon, min_lat, max_lon, max_lat)


def getAllWaterDistanceData(lat, lon):
    print(f"Begin Processing point getAllWaterDistanceData at latitude {lat}, longitude {lon}", file=sys.stderr)

    
    
    
    #waterbodies_shapefile = 'ga_ls_wb_3_v3/ga_ls_wb_3_v3.shp'
    country_shapes = load_shapefile(country_shapefile)

    print(f"Begin Processing point inland_water_proximity_and_location_DEA_Tools at latitude {lat}, longitude {lon}", file=sys.stderr)
    
    inland_result = inland_water_proximity_and_location_DEA_Tools(lat, lon,)
    
    print(f"End Processing point inland_water_proximity_and_location_DEA_Tools at latitude {lat}, longitude {lon}", file=sys.stderr)
    coastal_result = coastal_water_proximity_and_location(lat, lon, country_shapes)
    
    result = {
                "inland_water": inland_result,
                "coastal_water": coastal_result
            }
    print(f"Result: {result}", file=sys.stderr)
    return result
  
 


if len(sys.argv) != 4:
    print("Usage: script.py <latitude> <longitude>", file=sys.stderr)
    sys.exit(1)

# The following lines should not be indented further
lat = float(sys.argv[1])  # Convert latitude to float
lon = float(sys.argv[2])  # Convert longitude to float
# lets make a global variable for the shapefile path
country_shapefile = sys.argv[3]


print(f"Latitude: {lat}, Longitude: {lon}, shape file path{country_shapefile}", file=sys.stderr)
result = getAllWaterDistanceData(lat, lon)
print(json.dumps(result))  # Serialize and print the result as a JSON string
