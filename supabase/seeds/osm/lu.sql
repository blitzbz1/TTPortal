-- LU — Luxembourg — 32 venues, 19 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('LU','Luxembourg',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Belvaux','LU','Luxembourg','Esch-sur-Alzette','Sanem',49.51014,5.92414,12,false,'community_review'),
  ('Bettembourg','LU','Luxembourg','Esch-sur-Alzette','Bettembourg',49.51861,6.10278,12,false,'community_review'),
  ('Diekirch','LU','Luxembourg','Diekirch','Diekirch',49.86687,6.15451,12,false,'community_review'),
  ('Ell','LU','Luxembourg','Redange','Ell',49.76389,5.85722,12,false,'community_review'),
  ('Erpeldange','LU','Luxembourg','Diekirch','Erpeldange',49.86472,6.11472,12,false,'community_review'),
  ('Hautcharage','LU','Luxembourg','Capellen','Käerjeng',49.57499,5.9097,12,false,'community_review'),
  ('Hesperange','LU','Luxembourg','Luxembourg','Hesperange',49.56806,6.15139,12,false,'community_review'),
  ('Hosingen','LU','Luxembourg','Clervaux','Parc Hosingen',50.01218,6.09089,12,false,'community_review'),
  ('Howald','LU','Luxembourg','Luxembourg','Hesperange',49.58387,6.14277,12,false,'community_review'),
  ('Larochette','LU','Luxembourg','Mersch','Larochette',49.78362,6.21891,12,false,'community_review'),
  ('Lenningen','LU','Luxembourg','Remich','Lenningen',49.60045,6.36719,12,false,'community_review'),
  ('Luxembourg','LU','Luxembourg','Luxembourg','Ville de Luxembourg',49.60982,6.13268,12,false,'community_review'),
  ('Mamer','LU','Luxembourg','Capellen','Mamer',49.6275,6.02333,12,false,'community_review'),
  ('Medernach','LU','Luxembourg','Diekirch','Commune de la Vallée de l''Ernz',49.80955,6.21521,12,false,'community_review'),
  ('Müllendorf','LU','Luxembourg','Luxembourg','Steinsel',49.68028,6.13,12,false,'community_review'),
  ('Nommern','LU','Luxembourg','Mersch','Nommern',49.78694,6.17472,12,false,'community_review'),
  ('Pétange','LU','Luxembourg','Esch-sur-Alzette','Pétange',49.55833,5.88056,12,false,'community_review'),
  ('Rollingen','LU','Luxembourg','Mersch','Mersch',49.74167,6.11444,12,false,'community_review'),
  ('Weiler-la-Tour','LU','Luxembourg','Luxembourg','Weiler-la-Tour',49.54083,6.20083,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Tennis de table Rue Rosemarie Kieffer','parc_exterior','Luxembourg','Ville de Luxembourg',NULL,'Rue Rosemarie Kieffer 22, Luxembourg',49.62093,6.17256,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parc de Merl','parc_exterior','Luxembourg','Ville de Luxembourg',NULL,'Avenue Guillaume 83, Luxembourg',49.60707,6.11228,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parc de Merl (2)','parc_exterior','Luxembourg','Ville de Luxembourg',NULL,'Avenue Guillaume 81, Luxembourg',49.60701,6.11227,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Camping Birkelt','parc_exterior','Larochette','Larochette',NULL,'Camping Birkelt 1, Larochette',49.78389,6.21087,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Camping Birkelt (2)','parc_exterior','Larochette','Larochette',NULL,'Camping Birkelt 1, Larochette',49.78335,6.21159,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Haaptstrooss','parc_exterior','Ell','Ell',NULL,'Haaptstrooss 25, Ell',49.76209,5.85304,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Bisserweg','parc_exterior','Luxembourg','Ville de Luxembourg',NULL,'Bisserweg 18, Luxembourg',49.60771,6.13806,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Route de Luxembourg','parc_exterior','Müllendorf','Steinsel',NULL,'Route de Luxembourg 164, Müllendorf',49.68435,6.13621,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parc de Merl (3)','parc_exterior','Luxembourg','Ville de Luxembourg',NULL,'Avenue Guillaume 81, Luxembourg',49.60702,6.11228,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parc de Merl (4)','parc_exterior','Luxembourg','Ville de Luxembourg',NULL,'Avenue Guillaume 83, Luxembourg',49.60707,6.11228,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Plateau Altmunster','parc_exterior','Luxembourg','Ville de Luxembourg',NULL,'Rue du Fort Olisy 2, Luxembourg',49.61315,6.13798,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parc Um Päsch','parc_exterior','Hautcharage','Käerjeng',NULL,'Rue de Bascharage 14, Hautcharage',49.57376,5.90969,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Place Du Parc','parc_exterior','Luxembourg','Ville de Luxembourg',NULL,'Cour du Couvent 10, Luxembourg',49.59765,6.13877,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parke national de Diekirch','parc_exterior','Diekirch','Diekirch',NULL,'Op der Meierchen 6, Diekirch',49.87013,6.15761,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Op der Hobuch','parc_exterior','Hesperange','Hesperange',NULL,'Op der Hobuch 38, Hesperange',49.57104,6.14036,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Park Um Belval','parc_exterior','Belvaux','Sanem',NULL,'Avenue du Blues 100, Belvaux',49.50506,5.93643,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table La Sapinière','parc_exterior','Hosingen','Parc Hosingen',NULL,'An der Deckt 1A, Hosingen',49.99176,6.09987,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Fraternité','parc_exterior','Luxembourg','Ville de Luxembourg',NULL,'Boulevard de la Fraternité 13, Luxembourg',49.60103,6.14291,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Spidolsgaart','parc_exterior','Luxembourg','Ville de Luxembourg',NULL,'Rue du Pont 12, Luxembourg',49.61532,6.1324,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Rue de l''Eglise','parc_exterior','Weiler-la-Tour','Weiler-la-Tour',NULL,'Rue de l''Eglise 2A, Weiler-la-Tour',49.55023,6.20975,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Park Brill','parc_exterior','Mamer','Mamer',NULL,'Rue Bellevue 12, Mamer',49.62527,6.02566,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Nommerlayen','parc_exterior','Nommern','Nommern',NULL,'Rue Nommerlayen 99, Nommern',49.78441,6.16625,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parc Kaltreis','parc_exterior','Howald','Hesperange',NULL,'Boulevard Kaltreis 48, Howald',49.59354,6.15302,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parc bei der Schwemm','parc_exterior','Bettembourg','Bettembourg',NULL,'Rue James Hilliard Polk 4, Bettembourg',49.51625,6.09845,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Sportshal Lénger','parc_exterior','Pétange','Pétange',NULL,'Rue de la Libération 12, Pétange',49.56592,5.88708,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parc bei der Schwemm (2)','parc_exterior','Bettembourg','Bettembourg',NULL,'Rue James Hilliard Polk 10, Bettembourg',49.51615,6.09842,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Puddel','parc_exterior','Lenningen','Lenningen',NULL,'Route du Vin 133, Lenningen',49.60064,6.38816,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Rue du Réservoir','parc_exterior','Erpeldange','Erpeldange',NULL,'Rue du Réservoir 1, Erpeldange',49.88401,6.09083,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Kengert','parc_exterior','Medernach','Commune de la Vallée de l''Ernz',NULL,'Kengert 1, Medernach',49.8011,6.19885,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Kengert (2)','parc_exterior','Medernach','Commune de la Vallée de l''Ernz',NULL,'Kengert 1, Medernach',49.80107,6.19882,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Rue Yvonne Stoffel-Wagener','parc_exterior','Belvaux','Sanem',NULL,'Rue Yvonne Stoffel-Wagener 14, Belvaux',49.51625,5.91403,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parc communal de Mersch','parc_exterior','Rollingen','Mersch',NULL,'Parc communal de Mersch, Rollingen',49.74429,6.10834,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='LU' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
