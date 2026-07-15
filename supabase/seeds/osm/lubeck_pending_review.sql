-- Lübeck pending-review smoke fixture.
-- Purpose: test how an OSM batch appears in Admin -> Moderation without
-- applying the full Germany import or exposing the venues on the public map.
--
-- This intentionally differs from de.sql:
--   - city is active=false / community_review
--   - venues are approved=false, so getPendingVenues() returns them
--   - submitted_by is NULL, so admin cards show them as system/imported rows
--
-- Apply to a disposable/staging database only:
--   psql "$DB" -v ON_ERROR_STOP=1 -f lubeck_pending_review.sql

BEGIN;

INSERT INTO countries (code, name, active)
VALUES ('DE', 'Germany', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO cities (
  name, country_code, country_name, admin_area, county,
  lat, lng, zoom, active, expansion_status
) VALUES (
  'Lübeck', 'DE', 'Germany', 'Schleswig-Holstein', 'Schleswig-Holstein',
  53.86893, 10.68729, 12, false, 'community_review'
)
ON CONFLICT (country_code, name) DO NOTHING;

INSERT INTO venues (
  name, type, city, city_id, county, sector, address, lat, lng,
  tables_count, free_access, night_lighting, hours, description,
  tags, approved, verified, submitted_by
)
SELECT
  v.name,
  v.type,
  v.city,
  c.id,
  v.county::text,
  v.sector::text,
  v.address,
  v.lat::double precision,
  v.lng::double precision,
  v.tables_count::int,
  v.free_access::boolean,
  v.night_lighting::boolean,
  v.hours::text,
  v.description::text,
  v.tags::text[],
  false,
  v.verified::boolean,
  NULL
FROM (VALUES
  ('Tischtennis Carlebach-Park','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Maria-Goeppert-Straße 1, Lübeck',53.83469,10.69847,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Damaschkestraße','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Julius-Brecht-Straße 15, Lübeck',53.84053,10.68302,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Ernestinenschule','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Engelswisch 33/ 5, Lübeck',53.87279,10.68755,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Lunapark','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Hanseplatz 4a, Lübeck',53.86016,10.66332,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Carlebach-Park (2)','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Maria-Goeppert-Straße 1, Lübeck',53.83474,10.69862,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Carlebach-Park (3)','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Maria-Goeppert-Straße 9, Lübeck',53.83336,10.69483,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Carlebach-Park (4)','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Maria-Goeppert-Straße 9, Lübeck',53.83341,10.69498,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis An den Schießständen','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Pfeifengrasweg 21a, Lübeck',53.85799,10.74568,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Ziegelstraße','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Korvettenstraße 13, Lübeck',53.85665,10.6416,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Lunapark (2)','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Hanseplatz 4a, Lübeck',53.86013,10.66325,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Mühlenstraße','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Mühlenstraße 72, Lübeck',53.86144,10.68748,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Hundestraße 83/','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Hundestraße 83/ 1, Lübeck',53.86843,10.69402,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Hundestraße 83/ (2)','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Hundestraße 83/ 1, Lübeck',53.86841,10.69409,1,true,false,NULL,NULL,ARRAY['exterior'],false),
  ('Tischtennis Dornestraße','parc_exterior','Lübeck','Schleswig-Holstein',NULL,'Dornestraße 65, Lübeck',53.85934,10.66703,1,true,false,NULL,NULL,ARRAY['exterior'],false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,verified)
JOIN cities c ON c.country_code='DE' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;

COMMIT;
