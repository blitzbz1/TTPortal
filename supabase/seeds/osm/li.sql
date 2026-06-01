-- LI — Liechtenstein — 6 venues, 4 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('LI','Liechtenstein',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Mauren','LI','Liechtenstein','Mauren','Mauren',47.21805,9.5442,12,false,'community_review'),
  ('Schaan','LI','Liechtenstein','Schaan','Schaan',47.16498,9.50867,12,false,'community_review'),
  ('Triesen','LI','Liechtenstein','Triesen','Triesen',47.10752,9.52815,12,false,'community_review'),
  ('Vaduz','LI','Liechtenstein','Vaduz','Vaduz',47.14151,9.52154,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Tischtennis Primarschule Aeule','parc_exterior','Vaduz','Vaduz',NULL,'Giessenstrasse 7, Vaduz',47.1379,9.51974,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tischtennis Primarschule Aeule (2)','parc_exterior','Vaduz','Vaduz',NULL,'Giessenstrasse 7, Vaduz',47.13787,9.51965,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tischtennis Schulzentrum Mühleholz','parc_exterior','Schaan','Schaan',NULL,'Marianumstrasse 43, Schaan',47.15573,9.50505,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tischtennis Weiterführende Schulen Triesen','parc_exterior','Triesen','Triesen',NULL,'Landstrasse 313, Triesen',47.1048,9.52639,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tischtennis Robinson-Spielplatz','parc_exterior','Triesen','Triesen',NULL,'Alte Landstrasse 1, Triesen',47.09211,9.52483,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tischtennis Sport- und Freizeitanlage Weiherring','parc_exterior','Mauren','Mauren',NULL,'Weiherring 25, Mauren',47.21877,9.54407,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='LI' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
