-- MD — Moldova — 10 venues, 5 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('MD','Moldova',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Chisinau','MD','Moldova','Chișinău Municipality','Chișinău Municipality',47.00902,28.85938,12,false,'community_review'),
  ('Durlești','MD','Moldova','Chișinău Municipality','Chișinău Municipality',47.02156,28.76303,12,false,'community_review'),
  ('Fălești','MD','Moldova','Fălești','Fălești',47.57667,27.71264,12,false,'community_review'),
  ('Tiraspol','MD','Moldova','Transnistria','Transnistria',46.84275,29.6284,12,false,'community_review'),
  ('Vadul lui Vodă','MD','Moldova','Chișinău Municipality','Chișinău Municipality',47.09009,29.0757,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Stiga','parc_exterior','Chisinau','Chișinău Municipality',NULL,'Stiga, Chisinau',46.98555,28.85975,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Top Cup Academy','parc_exterior','Durlești','Chișinău Municipality',NULL,'Administrația de Stat a Drumurilor, Durlești',47.03914,28.81712,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masă de ping pong Parcul Râșcani','parc_exterior','Chisinau','Chișinău Municipality',NULL,'Parcul Râșcani, Chisinau',47.03597,28.8659,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa de Tenis de Masă','parc_exterior','Fălești','Fălești',NULL,'Parcul Multifuncțional, Fălești',47.55381,27.74128,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masă de ping pong Stațiunea balneară „Perlele Nistrului”','parc_exterior','Vadul lui Vodă','Chișinău Municipality',NULL,'Stațiunea balneară „Perlele Nistrului”, Vadul lui Vodă',47.07542,29.10048,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masă de ping pong Parcul „Valea Trandafirilor”','parc_exterior','Chisinau','Chișinău Municipality',NULL,'Parcul „Valea Trandafirilor”, Chisinau',47.00406,28.85325,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masă de ping pong Parcul „Valea Trandafirilor” (2)','parc_exterior','Chisinau','Chișinău Municipality',NULL,'Parcul „Valea Trandafirilor”, Chisinau',47.00401,28.85329,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masă de ping pong Parcul „Valea Trandafirilor” (3)','parc_exterior','Chisinau','Chișinău Municipality',NULL,'Parcul „Valea Trandafirilor”, Chisinau',47.00406,28.85325,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masă de ping pong Parcul „Valea Trandafirilor” (4)','parc_exterior','Chisinau','Chișinău Municipality',NULL,'Parcul „Valea Trandafirilor”, Chisinau',47.0041,28.85322,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный тенис','parc_exterior','Tiraspol','Transnistria',NULL,'Настольный тенис, Tiraspol',46.83996,29.664,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='MD' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
