-- AL — Albania — 7 venues, 2 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('AL','Albania',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Pukë','AL','Albania','Shkodër County','Bashkia Pukë',42.04444,19.89972,12,false,'community_review'),
  ('Tirana','AL','Albania','Tirana','Bashkia Tiranë',41.32744,19.81866,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Ping Pong KS Tirana','parc_exterior','Tirana','Bashkia Tiranë',NULL,'Shkolla e Mesme "Sinan Tafaj", Tirana',41.33115,19.81596,1,true,false,'Mo-Sa 08:00-20:00','KS Tirana',ARRAY['exterior'],true,false),
  ('Tenis tavoline Parku i Madh i Tiranës','parc_exterior','Tirana','Bashkia Tiranë',NULL,'Parku i Madh i Tiranës, Tirana',41.3133,19.81775,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tenis tavoline Parku i Madh i Tiranës (2)','parc_exterior','Tirana','Bashkia Tiranë',NULL,'Parku i Madh i Tiranës, Tirana',41.31332,19.81766,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tenis tavoline Parku i Madh i Tiranës (3)','parc_exterior','Tirana','Bashkia Tiranë',NULL,'Parku i Madh i Tiranës, Tirana',41.31334,19.81779,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tenis tavoline Parku i Madh i Tiranës (4)','parc_exterior','Tirana','Bashkia Tiranë',NULL,'Parku i Madh i Tiranës, Tirana',41.31331,19.81785,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tenis tavoline Stadiumi "ISMAIL XHEMALI" Pukë','parc_exterior','Pukë','Bashkia Pukë',NULL,'Stadiumi "ISMAIL XHEMALI" Pukë, Pukë',42.04446,19.8983,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Baste Live - Bar Sallon','parc_exterior','Tirana','Bashkia Tiranë',NULL,'Buzz, Tirana',41.3138,19.8035,1,true,false,'24/7',NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='AL' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
