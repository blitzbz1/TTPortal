-- 01-admin.sql — LOCAL admin assignment (no network).
-- For each point: country via Overture PIP (cached), then nearest GeoNames city in that country.
-- Produces data/pts_admin.parquet and prints distribution.
-- Run: duckdb < 01-admin.sql   (cwd = scripts/osm-import)

INSTALL spatial; LOAD spatial;

-- Country per point (countries don't overlap → DISTINCT ON guards rare dup geoms)
CREATE TEMP TABLE pc AS
SELECT * FROM (
  SELECT p.osm_id, p.lat, p.lng, p.geom, c.cc,
         row_number() OVER (PARTITION BY p.osm_id ORDER BY c.cc) AS rn
  FROM 'data/points.parquet' p
  LEFT JOIN 'data/ov_country_eu.parquet' c ON ST_Contains(c.geometry, p.geom)
) WHERE rn = 1;

-- Nearest GeoNames populated place in the SAME country (coarse 0.7° window, then true Haversine)
CREATE TEMP TABLE nc AS
SELECT osm_id, city, region, county, city_lat, city_lng, dist_m FROM (
  SELECT p.osm_id, g.name AS city, g.region, g.county, g.lat AS city_lat, g.lng AS city_lng,
         2*6371000*asin(sqrt(
           power(sin(radians(g.lat - p.lat)/2),2) +
           cos(radians(p.lat))*cos(radians(g.lat))*power(sin(radians(g.lng - p.lng)/2),2)
         )) AS dist_m,
         row_number() OVER (PARTITION BY p.osm_id ORDER BY
           power(g.lat - p.lat,2) + power((g.lng - p.lng)*cos(radians(p.lat)),2) ASC) AS rn
  FROM pc p
  JOIN 'data/geonames_eu.parquet' g
    ON p.cc = g.cc AND ST_DWithin(p.geom, g.geom, 0.7)
  WHERE p.cc IS NOT NULL
    -- exclude city SECTIONS (e.g. "Sector 3", PPLX) and non-current places, so points map to the real city
    AND g.fcode NOT IN ('PPLX','PPLH','PPLQ','PPLW','PPLR','PPLCH')
) WHERE rn = 1;

COPY (
  SELECT pc.osm_id, pc.lat, pc.lng, pc.cc,
         nc.city, nc.region, nc.county, nc.city_lat, nc.city_lng, nc.dist_m
  FROM pc LEFT JOIN nc USING (osm_id)
) TO 'data/pts_admin.parquet' (FORMAT parquet);

-- Distribution
SELECT
  count(*)                                                        AS total,
  count(*) FILTER (WHERE cc IS NULL)                              AS no_country,
  count(*) FILTER (WHERE city IS NULL)                            AS no_city_candidate,
  count(*) FILTER (WHERE dist_m > 30000)                          AS city_over_30km,
  count(*) FILTER (WHERE city IS NOT NULL AND dist_m <= 30000)    AS usable_city,
  round(median(dist_m))                                           AS median_city_dist_m
FROM 'data/pts_admin.parquet';
