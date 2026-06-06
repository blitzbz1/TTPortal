-- MC — Monaco — 2 venues, 1 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('MC','Monaco',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Monaco','MC','Monaco','Municipality of Monaco','Municipality of Monaco',43.73718,7.42145,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Tennis de table Parc Princesse Antoinette','parc_exterior','Monaco','Municipality of Monaco',NULL,'Chemin des Salines 104, Monaco',43.733465,7.41405,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tennis de table Parking du Chemin des Pêcheurs','parc_exterior','Monaco','Municipality of Monaco',NULL,'Parking du Chemin des Pêcheurs, Monaco',43.73114,7.427175,2,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='MC' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
