-- 02-enrich-overture.sql — STREAMED reverse-geocode via Overture (one pass per theme).
-- Builds the spatial index on the 47k local points and streams each Europe theme through it.
-- Writes one parquet per theme so a failure in the big `addresses` read doesn't lose the rest.
-- Run: duckdb < 02-enrich-overture.sql   (cwd = scripts/osm-import)
-- Release pinned for reproducibility; bbox = Europe extent intersection.

INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;
SET s3_region='us-west-2';
SET enable_progress_bar=true;

CREATE TEMP TABLE pts AS SELECT osm_id, lat, lng, geom FROM 'data/points.parquet';

-- (A) Containing NAMED park/square — smallest-area polygon wins -----------------
COPY (
  SELECT p.osm_id,
         arg_min(lu.nm,  lu.area) AS park_name,
         arg_min(lu.cls, lu.area) AS park_class
  FROM pts p
  JOIN (
    SELECT names.primary AS nm, class AS cls, ST_Area(geometry) AS area, geometry
    FROM read_parquet('s3://overturemaps-us-west-2/release/2026-05-20.0/theme=base/type=land_use/*', hive_partitioning=1)
    WHERE names.primary IS NOT NULL
      AND bbox.xmin<=45 AND bbox.xmax>=-25 AND bbox.ymin<=72 AND bbox.ymax>=34
  ) lu ON ST_Contains(lu.geometry, p.geom)
  GROUP BY p.osm_id
) TO 'data/enr_park.parquet' (FORMAT parquet);

-- (B) Nearest NAMED "good" POI within ~150 m (park/plaza/playground/garden/sports/square) ---
COPY (
  SELECT osm_id, poi_name, poi_cat, round(poi_dist_m) AS poi_dist_m FROM (
    SELECT p.osm_id, pl.nm AS poi_name, pl.cat AS poi_cat,
           2*6371000*asin(sqrt(power(sin(radians(ST_Y(pl.g)-p.lat)/2),2)
             + cos(radians(p.lat))*cos(radians(ST_Y(pl.g)))*power(sin(radians(ST_X(pl.g)-p.lng)/2),2))) AS poi_dist_m,
           row_number() OVER (PARTITION BY p.osm_id ORDER BY
             power(ST_Y(pl.g)-p.lat,2)+power((ST_X(pl.g)-p.lng)*cos(radians(p.lat)),2) ASC) AS rn
    FROM pts p
    JOIN (
      SELECT names.primary AS nm, categories.primary AS cat, geometry AS g
      FROM read_parquet('s3://overturemaps-us-west-2/release/2026-05-20.0/theme=places/type=place/*', hive_partitioning=1)
      WHERE names.primary IS NOT NULL
        AND bbox.xmin<=45 AND bbox.xmax>=-25 AND bbox.ymin<=72 AND bbox.ymax>=34
        AND (lower(categories.primary) LIKE '%park%' OR lower(categories.primary) LIKE '%plaza%'
          OR lower(categories.primary) LIKE '%playground%' OR lower(categories.primary) LIKE '%garden%'
          OR lower(categories.primary) LIKE '%sport%' OR lower(categories.primary) LIKE '%recreation%'
          OR lower(categories.primary) LIKE '%square%' OR lower(categories.primary) LIKE '%stadium%')
    ) pl ON ST_DWithin(pl.g, p.geom, 0.002)
  ) WHERE rn=1
) TO 'data/enr_poi.parquet' (FORMAT parquet);

-- (C) Nearest street address within ~180 m ------------------------------------
COPY (
  SELECT osm_id, street, number, round(addr_dist_m) AS addr_dist_m FROM (
    SELECT p.osm_id, ad.street, ad.number,
           2*6371000*asin(sqrt(power(sin(radians(ST_Y(ad.g)-p.lat)/2),2)
             + cos(radians(p.lat))*cos(radians(ST_Y(ad.g)))*power(sin(radians(ST_X(ad.g)-p.lng)/2),2))) AS addr_dist_m,
           row_number() OVER (PARTITION BY p.osm_id ORDER BY
             power(ST_Y(ad.g)-p.lat,2)+power((ST_X(ad.g)-p.lng)*cos(radians(p.lat)),2) ASC) AS rn
    FROM pts p
    JOIN (
      SELECT street, number, geometry AS g
      FROM read_parquet('s3://overturemaps-us-west-2/release/2026-05-20.0/theme=addresses/type=address/*', hive_partitioning=1)
      WHERE street IS NOT NULL
        AND bbox.xmin<=45 AND bbox.xmax>=-25 AND bbox.ymin<=72 AND bbox.ymax>=34
    ) ad ON ST_DWithin(ad.g, p.geom, 0.0025)
  ) WHERE rn=1
) TO 'data/enr_addr.parquet' (FORMAT parquet);

SELECT 'enr_park' AS t, count(*) AS n FROM 'data/enr_park.parquet'
UNION ALL SELECT 'enr_poi',  count(*) FROM 'data/enr_poi.parquet'
UNION ALL SELECT 'enr_addr', count(*) FROM 'data/enr_addr.parquet';
