-- 02c-addr.sql — nearest street address within ~180 m (the heavy theme; run alone, in background).
-- Parks + POI are produced by 02-enrich-overture.sql (statements A/B); this redoes only addresses.
-- Run: duckdb < 02c-addr.sql   (cwd = scripts/osm-import)

INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;
SET s3_region='us-west-2';

CREATE TEMP TABLE pts AS SELECT osm_id, lat, lng, geom FROM 'data/points.parquet';

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

SELECT count(*) AS addr_rows FROM 'data/enr_addr.parquet';
