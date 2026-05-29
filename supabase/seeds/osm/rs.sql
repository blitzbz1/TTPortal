-- RS — Serbia — 31 venues, 15 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('RS','Serbia',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Beograd','RS','Serbia','Central Serbia','Belgrade',44.80401,20.46513,12,false,'community_review'),
  ('Čukarica','RS','Serbia','Central Serbia','Belgrade',44.7825,20.42028,12,false,'community_review'),
  ('Filmski Grad','RS','Serbia','Central Serbia','Belgrade',44.75667,20.43778,12,false,'community_review'),
  ('Kragujevac','RS','Serbia','Central Serbia','Šumadija',44.01667,20.91667,12,false,'community_review'),
  ('Novi Beograd','RS','Serbia','Central Serbia','Belgrade',44.80556,20.42417,12,false,'community_review'),
  ('Novi Sad','RS','Serbia','Vojvodina','South Bačka',45.25167,19.83694,12,false,'community_review'),
  ('Ostružnica','RS','Serbia','Central Serbia','Belgrade',44.72769,20.31845,12,false,'community_review'),
  ('Pančevo','RS','Serbia','Vojvodina','South Banat',44.87177,20.64167,12,false,'community_review'),
  ('Šabac','RS','Serbia','Central Serbia','Mačva',44.74667,19.69,12,false,'community_review'),
  ('Sremska Mitrovica','RS','Serbia','Vojvodina','Srem',44.97639,19.61222,12,false,'community_review'),
  ('Stari Grad','RS','Serbia','Central Serbia','Belgrade',44.81789,20.46186,12,false,'community_review'),
  ('Subotica','RS','Serbia','Vojvodina','North Bačka',46.1,19.66667,12,false,'community_review'),
  ('Užice','RS','Serbia','Central Serbia','Zlatibor',43.85861,19.84878,12,false,'community_review'),
  ('Vršac','RS','Serbia','Vojvodina','South Banat',45.11667,21.30361,12,false,'community_review'),
  ('Zemun','RS','Serbia','Central Serbia','Belgrade',44.8458,20.40116,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Stoni tenis Велики Калемегдан','parc_exterior','Stari Grad','Belgrade',NULL,'KALEMEGDAN GORNJI GRAD 9, Stari Grad',44.82115,20.45021,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Блок 9','parc_exterior','Zemun','Belgrade',NULL,'KARAĐORĐEV TRG 13, Zemun',44.83582,20.41888,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Савски парк','parc_exterior','Beograd','Belgrade',NULL,'LUKE ĆELOVIĆA TREBINJCA 17, Beograd',44.80503,20.45174,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Савски парк (2)','parc_exterior','Beograd','Belgrade',NULL,'LUKE ĆELOVIĆA TREBINJCA 17, Beograd',44.80503,20.45161,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Савски парк (3)','parc_exterior','Beograd','Belgrade',NULL,'LUKE ĆELOVIĆA TREBINJCA 17, Beograd',44.80504,20.45149,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Спомен-парк Крагујевачки октобар','parc_exterior','Kragujevac','Šumadija',NULL,'DRAGIŠE VITOŠEVIĆA 2, Kragujevac',44.02997,20.87913,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Спомен-парк Крагујевачки октобар (2)','parc_exterior','Kragujevac','Šumadija',NULL,'DRAGIŠE VITOŠEVIĆA 2, Kragujevac',44.03001,20.87914,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Спомен-парк Крагујевачки октобар (3)','parc_exterior','Kragujevac','Šumadija',NULL,'DRAGIŠE VITOŠEVIĆA 2, Kragujevac',44.02999,20.87902,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Спомен-парк Крагујевачки октобар (4)','parc_exterior','Kragujevac','Šumadija',NULL,'DRAGIŠE VITOŠEVIĆA 2, Kragujevac',44.03003,20.87903,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Спомен-парк Крагујевачки октобар (5)','parc_exterior','Kragujevac','Šumadija',NULL,'DRAGIŠE VITOŠEVIĆA 6A, Kragujevac',44.03002,20.87891,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Спомен-парк Крагујевачки октобар (6)','parc_exterior','Kragujevac','Šumadija',NULL,'DRAGIŠE VITOŠEVIĆA 6A, Kragujevac',44.03006,20.87892,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Велики парк','parc_exterior','Užice','Zlatibor',NULL,'VELIKI PARK 14, Užice',43.84927,19.84564,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Блок 45','parc_exterior','Čukarica','Belgrade',NULL,'DR IVANA RIBARA 189, Čukarica',44.79393,20.37886,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Градска плажа Ужице','parc_exterior','Užice','Zlatibor',NULL,'HEROJA LUNA 2, Užice',43.85295,19.83316,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Међај','parc_exterior','Užice','Zlatibor',NULL,'MEĐAJ 45, Užice',43.8539,19.83503,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis SAVE LJUBOJEVA','parc_exterior','Novi Sad','South Bačka',NULL,'SAVE LJUBOJEVA 7, Novi Sad',45.26453,19.83364,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Блок 44','parc_exterior','Novi Beograd','Belgrade',NULL,'GANDIJEVA 190, Novi Beograd',44.79968,20.38478,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Блок 44 (2)','parc_exterior','Novi Beograd','Belgrade',NULL,'GANDIJEVA 190, Novi Beograd',44.79968,20.38473,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Блок 70','parc_exterior','Novi Beograd','Belgrade',NULL,'JURIJA GAGARINA 43, Novi Beograd',44.80109,20.39943,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Igraliste ul Luke Vojvodica','parc_exterior','Filmski Grad','Belgrade',NULL,'LUKE VOJVODIĆA 67, Filmski Grad',44.75216,20.43634,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Pedaleros Kayak  Shop','parc_exterior','Novi Sad','South Bačka',NULL,'SUNČANI KEJ 33, Novi Sad',45.23949,19.85104,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Jovana Ivanišević - fitness instructor','parc_exterior','Novi Sad','South Bačka',NULL,'BEOGRADSKI KEJ 37, Novi Sad',45.2606,19.85476,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis TRG MUČENIKA','parc_exterior','Pančevo','South Banat',NULL,'TRG MUČENIKA 11, Pančevo',44.8705,20.63375,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis STAMBENO NASELJE MATIJA HUĐI','parc_exterior','Sremska Mitrovica','Srem',NULL,'STAMBENO NASELJE MATIJA HUĐI 49, Sremska Mitrovica',44.97673,19.61299,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Ping Pong Room','parc_exterior','Čukarica','Belgrade',NULL,'VISOKA 19, Čukarica',44.78709,20.41856,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Smash','parc_exterior','Subotica','North Bačka',NULL,'DRAGIŠE MIŠOVIĆA 32, Subotica',46.09144,19.67419,1,true,false,'Mo-Su 10:00-12:00, 16:00-23:00',NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Sport Vision','parc_exterior','Vršac','South Banat',NULL,'SVETOZARA MILETIĆA 5, Vršac',45.11944,21.29449,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Сава парк','parc_exterior','Šabac','Mačva',NULL,'Сава парк, Šabac',44.76272,19.70304,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Сава парк (2)','parc_exterior','Šabac','Mačva',NULL,'Сава парк, Šabac',44.76272,19.70309,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis Igralište za decu','parc_exterior','Novi Sad','South Bačka',NULL,'SIMEONA PIŠČEVIĆA 11, Novi Sad',45.25276,19.80924,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stoni tenis STJEPANA SUPANCA','parc_exterior','Ostružnica','Belgrade',NULL,'STJEPANA SUPANCA 2A, Ostružnica',44.72961,20.37532,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='RS' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
