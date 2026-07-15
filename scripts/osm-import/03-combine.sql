-- 03-combine.sql — join admin + tags + Overture enrichment + existing-venue proximity → NDJSON.
-- Produces data/enriched.ndjson (one JSON object per line) for the Node derive step.
-- Run AFTER 02 completes: duckdb < 03-combine.sql   (cwd = scripts/osm-import)

INSTALL spatial; LOAD spatial;

-- Existing venues (precedence): coordinates from the freshest local snapshot.
CREATE TEMP TABLE ev AS
  SELECT ST_Point(lng, lat) AS geom
  FROM read_json_auto('/Users/tavi/Projects/TTPortal/backups/venues.json')
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Min distance (m) from each point to any existing venue (≤ ~220 m prefilter; else far).
CREATE TEMP TABLE near AS
  SELECT p.osm_id,
         min(2*6371000*asin(sqrt(power(sin(radians(ST_Y(ev.geom)-p.lat)/2),2)
           + cos(radians(p.lat))*cos(radians(ST_Y(ev.geom)))*power(sin(radians(ST_X(ev.geom)-p.lng)/2),2)))) AS min_existing_m
  FROM 'data/points.parquet' p
  JOIN ev ON ST_DWithin(ev.geom, p.geom, 0.003)
  GROUP BY p.osm_id;

COPY (
  SELECT a.osm_id, a.lat, a.lng, a.cc, a.city, a.region, a.county,
         a.city_lat, a.city_lng, a.dist_m AS city_dist_m,
         pt.osm_name, pt.tag_access, pt.tag_lit, pt.tag_fee, pt.tag_surface, pt.tag_operator, pt.tag_hours,
         pk.park_name, pk.park_class,
         po.poi_name, po.poi_cat, po.poi_dist_m,
         ad.street, ad.number, ad.addr_dist_m,
         COALESCE(n.min_existing_m, 1e9) AS min_existing_m
  FROM 'data/pts_admin.parquet' a
  LEFT JOIN (SELECT osm_id, osm_name, tag_access, tag_lit, tag_fee, tag_surface, tag_operator, tag_hours
             FROM 'data/points.parquet') pt USING (osm_id)
  LEFT JOIN 'data/enr_park.parquet' pk USING (osm_id)
  LEFT JOIN 'data/enr_poi.parquet'  po USING (osm_id)
  LEFT JOIN 'data/enr_addr.parquet' ad USING (osm_id)
  LEFT JOIN near n USING (osm_id)
) TO 'data/enriched.ndjson' (FORMAT json, ARRAY false);

SELECT count(*) AS enriched_rows FROM 'data/enriched.ndjson';
