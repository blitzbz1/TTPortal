-- LT — Lithuania — 40 venues, 12 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('LT','Lithuania',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Birštonas','LT','Lithuania','Kaunas','Birštonas',54.608,24.034,12,false,'community_review'),
  ('Kaunas','LT','Lithuania','Kaunas','Kaunas',54.90156,23.90909,12,false,'community_review'),
  ('Klaipėda','LT','Lithuania','Klaipėda County','Klaipėda',55.7068,21.13912,12,false,'community_review'),
  ('Lentvaris','LT','Lithuania','Vilnius','Trakai',54.64364,25.05162,12,false,'community_review'),
  ('Pabradė','LT','Lithuania','Vilnius','Svencionys',54.981,25.761,12,false,'community_review'),
  ('Palanga','LT','Lithuania','Klaipėda County','Klaipėda',55.9175,21.06861,12,false,'community_review'),
  ('Prienai','LT','Lithuania','Kaunas','Prienai',54.636,23.94585,12,false,'community_review'),
  ('Šiauliai','LT','Lithuania','Siauliai','Šiauliai',55.93333,23.31667,12,false,'community_review'),
  ('Silute','LT','Lithuania','Klaipėda County','Šilutė',55.34889,21.48306,12,false,'community_review'),
  ('Ukmerge','LT','Lithuania','Vilnius','Ukmergė',55.25,24.75,12,false,'community_review'),
  ('Vilnius','LT','Lithuania','Vilnius','Vilnius',54.68916,25.2798,12,false,'community_review'),
  ('Visaginas','LT','Lithuania','Utena','Visaginas',55.59678,26.43984,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Stalo tenisas Birštono miesto centrinis parkas','parc_exterior','Birštonas','Birštonas',NULL,'Algirdo g. 34, Birštonas',54.61007,24.02973,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Birštono miesto centrinis parkas (2)','parc_exterior','Birštonas','Birštonas',NULL,'Algirdo g. 25, Birštonas',54.60838,24.03001,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Revuonos parkas','parc_exterior','Prienai','Prienai',NULL,'Dariaus ir Girėno g. 8, Prienai',54.6293,23.94619,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Klaipėdos poilsio parkas','parc_exterior','Klaipėda','Klaipėda',NULL,'Parko g. 19, Klaipėda',55.72507,21.11851,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Beržynėlis','parc_exterior','Šiauliai','Šiauliai',NULL,'Gegužių g. 51A, Šiauliai',55.9109,23.25676,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Beržynėlis (2)','parc_exterior','Šiauliai','Šiauliai',NULL,'Gegužių g. 51A, Šiauliai',55.91088,23.25683,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas KTU studentų miestelis','parc_exterior','Kaunas','Kaunas',NULL,'Studentų g. 48, Kaunas',54.90563,23.95581,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Palangos kempingas','parc_exterior','Palanga','Klaipėda',NULL,'Klaipėdos pl. 33D, Palanga',55.8771,21.06501,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Asvejos regioninis parkas','parc_exterior','Pabradė','Svencionys',NULL,'Asvejos regioninis parkas, Pabradė',55.04782,25.49714,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Mikalojaus Konstantino Čiurlionio gatvė','parc_exterior','Vilnius','Vilnius',NULL,'M. K. Čiurlionio g. 16A, Vilnius',54.6819,25.26426,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Pašilaičių miško parkas','parc_exterior','Vilnius','Vilnius',NULL,'Pašilaičių g. 18, Vilnius',54.73278,25.22842,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Sapiegų rūmų parkas','parc_exterior','Vilnius','Vilnius',NULL,'Antakalnio g. 17, Vilnius',54.69684,25.30914,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Draugystės g.','parc_exterior','Visaginas','Visaginas',NULL,'Draugystės g. 10B, Visaginas',55.59265,26.44699,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Draugystės g. (2)','parc_exterior','Visaginas','Visaginas',NULL,'Draugystės g. 12, Visaginas',55.59256,26.44705,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Draugystės g. (3)','parc_exterior','Visaginas','Visaginas',NULL,'Draugystės g. 12, Visaginas',55.59259,26.4471,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Draugystės g. (4)','parc_exterior','Visaginas','Visaginas',NULL,'Draugystės g. 10B, Visaginas',55.59262,26.44693,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Draugystės parkas','parc_exterior','Kaunas','Kaunas',NULL,'Kovo 11-osios g. 72, Kaunas',54.91381,23.97267,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Draugystės parkas (2)','parc_exterior','Kaunas','Kaunas',NULL,'Kovo 11-osios g. 72, Kaunas',54.91389,23.97262,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Pilies parkas','parc_exterior','Ukmerge','Ukmergė',NULL,'Pilies g. 13, Ukmerge',55.24875,24.7643,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Ozo parkas','parc_exterior','Vilnius','Vilnius',NULL,'K. Ulvydo g. 5, Vilnius',54.71796,25.28145,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Draugystės parkas (3)','parc_exterior','Kaunas','Kaunas',NULL,'Taikos pr. 83, Kaunas',54.91485,23.97043,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Birštono miesto centrinis parkas (3)','parc_exterior','Birštonas','Birštonas',NULL,'Algirdo g. 25, Birštonas',54.60875,24.02991,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Šilutės parkas','parc_exterior','Silute','Šilutė',NULL,'Stadiono g. 10E, Silute',55.3368,21.48835,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Kalniečių parkas','parc_exterior','Kaunas','Kaunas',NULL,'Savanorių pr. 347, Kaunas',54.922,23.95444,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Munto','parc_exterior','Vilnius','Vilnius',NULL,'Manufaktūrų g. 24, Vilnius',54.67824,25.31946,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Munto (2)','parc_exterior','Vilnius','Vilnius',NULL,'Manufaktūrų g. 24, Vilnius',54.67828,25.31932,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Munto (3)','parc_exterior','Vilnius','Vilnius',NULL,'Manufaktūrų g. 24, Vilnius',54.67831,25.31918,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Munto (4)','parc_exterior','Vilnius','Vilnius',NULL,'Kaukysos g. 20, Vilnius',54.67835,25.31904,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Uosių g.','parc_exterior','Šiauliai','Šiauliai',NULL,'Uosių g. 2, Šiauliai',55.932,23.32789,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Uosių g. (2)','parc_exterior','Šiauliai','Šiauliai',NULL,'Uosių g. 2, Šiauliai',55.93199,23.32794,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas UNIPARK','parc_exterior','Vilnius','Vilnius',NULL,'Verkių g. 25A, Vilnius',54.70937,25.29084,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Kalvarijų g.','parc_exterior','Vilnius','Vilnius',NULL,'Kalvarijų g. 137E, Vilnius',54.71718,25.28787,1,false,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas UNIPARK (2)','parc_exterior','Vilnius','Vilnius',NULL,'Kareivių g. 14, Vilnius',54.72014,25.29892,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Sensum judesio studija','parc_exterior','Vilnius','Vilnius',NULL,'Nidos g. 5, Vilnius',54.71102,25.18502,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Baltojo tilto krepšinio aikštelė','parc_exterior','Vilnius','Vilnius',NULL,'Upės g. 6, Vilnius',54.6931,25.2742,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Tylioji g.','parc_exterior','Prienai','Prienai',NULL,'Tylioji g. 7, Prienai',54.64194,23.95415,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Vaivorų g.','parc_exterior','Lentvaris','Trakai',NULL,'Vaivorų g. 4, Lentvaris',54.65234,25.09227,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Žalgirio g.','parc_exterior','Silute','Šilutė',NULL,'Žalgirio g. 4, Silute',55.34182,21.47085,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Verkių g.','parc_exterior','Vilnius','Vilnius',NULL,'Verkių g. 45A, Vilnius',54.72385,25.2959,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stalo tenisas Birutės g.','parc_exterior','Vilnius','Vilnius',NULL,'Birutės g. 32A, Vilnius',54.69187,25.24386,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='LT' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
