-- 00-prep.sql — one-time local prep (no network).
-- Produces:
--   data/points.parquet      : 47,209 OSM table points, typed, with extracted OSM tags + geometry
--   data/geonames_eu.parquet : GeoNames populated places in Europe with region/county names + geometry
-- Run: duckdb < 00-prep.sql   (cwd = scripts/osm-import)

INSTALL spatial; LOAD spatial;

-- 1) Table points from tables.json -------------------------------------------
COPY (
  SELECT
    i                                   AS osm_id,
    "at"                                AS lat,
    ng                                  AS lng,
    NULLIF(trim(n), '')                 AS osm_name,
    json_extract_string(t, '$.access')        AS tag_access,
    json_extract_string(t, '$.lit')           AS tag_lit,
    json_extract_string(t, '$.fee')           AS tag_fee,
    json_extract_string(t, '$.surface')       AS tag_surface,
    json_extract_string(t, '$.operator')      AS tag_operator,
    json_extract_string(t, '$.opening_hours') AS tag_hours,
    ST_Point(ng, "at")                  AS geom
  FROM read_json(
    '/Users/tavi/Projects/TTPortal/tables.json',
    columns = {i: 'BIGINT', "at": 'DOUBLE', ng: 'DOUBLE', n: 'VARCHAR', t: 'JSON'}
  )
) TO 'data/points.parquet' (FORMAT parquet);

-- 2) GeoNames Europe gazetteer (populated places only) -----------------------
CREATE TEMP TABLE gn AS
  SELECT * FROM read_csv(
    'data/cities1000.txt', delim = '\t', header = false, quote = '', nullstr = '',
    columns = {
      geonameid:'BIGINT', name:'VARCHAR', asciiname:'VARCHAR', alternatenames:'VARCHAR',
      lat:'DOUBLE', lng:'DOUBLE', fclass:'VARCHAR', fcode:'VARCHAR', cc:'VARCHAR', cc2:'VARCHAR',
      admin1:'VARCHAR', admin2:'VARCHAR', admin3:'VARCHAR', admin4:'VARCHAR',
      population:'BIGINT', elevation:'VARCHAR', dem:'VARCHAR', timezone:'VARCHAR', moddate:'VARCHAR'
    });

CREATE TEMP TABLE a1 AS
  SELECT * FROM read_csv('data/admin1CodesASCII.txt', delim='\t', header=false, quote='', nullstr='',
    columns = {code:'VARCHAR', name:'VARCHAR', asciiname:'VARCHAR', geonameid:'BIGINT'});

CREATE TEMP TABLE a2 AS
  SELECT * FROM read_csv('data/admin2Codes.txt', delim='\t', header=false, quote='', nullstr='',
    columns = {code:'VARCHAR', name:'VARCHAR', asciiname:'VARCHAR', geonameid:'BIGINT'});

COPY (
  SELECT
    g.geonameid, g.name, g.asciiname, g.lat, g.lng, g.fcode, g.cc, g.population,
    a1.name AS region,
    a2.name AS county,
    ST_Point(g.lng, g.lat) AS geom
  FROM gn g
  LEFT JOIN a1 ON a1.code = g.cc || '.' || g.admin1
  LEFT JOIN a2 ON a2.code = g.cc || '.' || g.admin1 || '.' || g.admin2
  WHERE g.fclass = 'P'                          -- populated places
    AND g.lat BETWEEN 33 AND 73
    AND g.lng BETWEEN -26 AND 46
) TO 'data/geonames_eu.parquet' (FORMAT parquet);

-- sanity
SELECT 'points' AS t, count(*) AS n FROM 'data/points.parquet'
UNION ALL SELECT 'geonames_eu', count(*) FROM 'data/geonames_eu.parquet';
