-- BA — Bosnia and Herzegovina — 8 venues, 6 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('BA','Bosnia and Herzegovina',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Banja Luka','BA','Bosnia and Herzegovina','Srpska','Srpska',44.77879,17.20629,12,false,'community_review'),
  ('Bihać','BA','Bosnia and Herzegovina','Federation of B&H','Unsko-Sanski Kanton',44.81694,15.87083,12,false,'community_review'),
  ('Jajce','BA','Bosnia and Herzegovina','Federation of B&H','Federation of B&H',44.34203,17.27059,12,false,'community_review'),
  ('Kobilja Glava','BA','Bosnia and Herzegovina','Federation of B&H','Federation of B&H',43.88188,18.38864,12,false,'community_review'),
  ('Tuzla','BA','Bosnia and Herzegovina','Federation of B&H','Federation of B&H',44.53842,18.66709,12,false,'community_review'),
  ('Zenica','BA','Bosnia and Herzegovina','Federation of B&H','Federation of B&H',44.20169,17.90397,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Stonoteniski klub "STENS-EURO ASFALT"','parc_exterior','Kobilja Glava','Federation of B&H',NULL,'Bokserski klub Zlatni Ljiljani, Kobilja Glava',43.85749,18.41564,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Una RC Kiro Rafting Camp','parc_exterior','Bihać','Unsko-Sanski Kanton',NULL,'Una RC Kiro Rafting Camp, Bihać',44.78257,15.92536,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Plivsko jezero','parc_exterior','Jajce','Federation of B&H',NULL,'Plivsko jezero, Jajce',44.35121,17.22671,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Grbavica','parc_exterior','Tuzla','Federation of B&H',NULL,'Grbavica, Tuzla',44.53772,18.69437,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis','parc_exterior','Zenica','Federation of B&H',NULL,'Arena Husejin Smajlović, Zenica',44.2025,17.91395,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Univerzitetski grad','parc_exterior','Banja Luka','Srpska',NULL,'Univerzitetski grad, Banja Luka',44.77506,17.20951,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Univerzitetski grad (2)','parc_exterior','Banja Luka','Srpska',NULL,'Univerzitetski grad, Banja Luka',44.77508,17.2098,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Univerzitetski grad (3)','parc_exterior','Banja Luka','Srpska',NULL,'Univerzitetski grad, Banja Luka',44.77513,17.21068,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='BA' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
