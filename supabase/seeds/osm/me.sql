-- ME — Montenegro — 30 venues, 5 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('ME','Montenegro',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Bar','ME','Montenegro','Bar','Bar',42.0937,19.09841,12,false,'community_review'),
  ('Budva','ME','Montenegro','Budva','Budva',42.28721,18.83922,12,false,'community_review'),
  ('Cetinje','ME','Montenegro','Cetinje','Cetinje',42.39063,18.91417,12,false,'community_review'),
  ('Petrovac na Moru','ME','Montenegro','Budva','Budva',42.20556,18.9425,12,false,'community_review'),
  ('Podgorica','ME','Montenegro','Podgorica','Podgorica',42.44124,19.26309,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Stoni tenis Park prirode Katič','parc_exterior','Petrovac na Moru','Budva',NULL,'Park prirode Katič, Petrovac na Moru',42.20528,18.9446,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Ul. 13. Jula','parc_exterior','Podgorica','Podgorica',NULL,'Ul. 13. Jula, Podgorica',42.44555,19.25519,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Njegošev park','parc_exterior','Podgorica','Podgorica',NULL,'Njegošev park, Podgorica',42.44272,19.25918,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Centralni park Pobrežje','parc_exterior','Podgorica','Podgorica',NULL,'Centralni park Pobrežje, Podgorica',42.43064,19.25918,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Centralni park Pobrežje (2)','parc_exterior','Podgorica','Podgorica',NULL,'Centralni park Pobrežje, Podgorica',42.43068,19.25919,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Njegošev park (2)','parc_exterior','Podgorica','Podgorica',NULL,'Njegošev park, Podgorica',42.44268,19.25916,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Park Stari Aerodrom','parc_exterior','Podgorica','Podgorica',NULL,'Park Stari Aerodrom, Podgorica',42.43397,19.27722,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Blok 5 (2)','parc_exterior','Podgorica','Podgorica',NULL,'Blok 5, Podgorica',42.44709,19.2443,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Univerzitet Crne Gore','parc_exterior','Podgorica','Podgorica',NULL,'Univerzitet Crne Gore, Podgorica',42.44209,19.23637,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Univerzitet Crne Gore (2)','parc_exterior','Podgorica','Podgorica',NULL,'Univerzitet Crne Gore, Podgorica',42.44215,19.23642,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Private Garage','parc_exterior','Podgorica','Podgorica',NULL,'Private Garage, Podgorica',42.43554,19.26286,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Kutak Sreće','parc_exterior','Podgorica','Podgorica',NULL,'Kutak Sreće, Podgorica',42.44589,19.25063,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Kutak Sreće (2)','parc_exterior','Podgorica','Podgorica',NULL,'Kutak Sreće, Podgorica',42.44605,19.25061,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Tološka Šuma','parc_exterior','Podgorica','Podgorica',NULL,'Tološka Šuma, Podgorica',42.44658,19.23534,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Tološka Šuma (2)','parc_exterior','Podgorica','Podgorica',NULL,'Tološka Šuma, Podgorica',42.44604,19.23607,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Tološka Šuma (3)','parc_exterior','Podgorica','Podgorica',NULL,'Tološka Šuma, Podgorica',42.44578,19.23659,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Tološka Šuma (4)','parc_exterior','Podgorica','Podgorica',NULL,'Tološka Šuma, Podgorica',42.4457,19.23705,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Danica Fitnes Studio','parc_exterior','Podgorica','Podgorica',NULL,'Danica Fitnes Studio, Podgorica',42.45024,19.25898,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Park Divizija','parc_exterior','Cetinje','Cetinje',NULL,'Park Divizija, Cetinje',42.39464,18.92083,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Njegošev Park','parc_exterior','Cetinje','Cetinje',NULL,'Njegošev Park, Cetinje',42.38539,18.92569,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Park šuma Ljubović','parc_exterior','Podgorica','Podgorica',NULL,'Park šuma Ljubović, Podgorica',42.43203,19.25323,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Park šuma Ljubović (2)','parc_exterior','Podgorica','Podgorica',NULL,'Park šuma Ljubović, Podgorica',42.43208,19.25325,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Central Park Suite','parc_exterior','Podgorica','Podgorica',NULL,'Central Park Suite, Podgorica',42.44722,19.23724,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Vrtić Poletarac','parc_exterior','Podgorica','Podgorica',NULL,'Vrtić Poletarac, Podgorica',42.42481,19.25315,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Alexandar','parc_exterior','Budva','Budva',NULL,'Alexandar, Budva',42.28558,18.84847,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Alexandar (2)','parc_exterior','Budva','Budva',NULL,'Alexandar, Budva',42.2855,18.84848,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Area with concrete ping pong tables','parc_exterior','Budva','Budva',NULL,'Intersport Crna Gora, Budva',42.28519,18.84604,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Blok 5','parc_exterior','Podgorica','Podgorica',NULL,'Blok 5, Podgorica',42.44871,19.24075,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Pionirski Park','parc_exterior','Bar','Bar',NULL,'Pionirski Park, Bar',42.09507,19.09324,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Bar','parc_exterior','Bar','Bar',NULL,'Bar, Bar',42.10216,19.08975,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='ME' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
