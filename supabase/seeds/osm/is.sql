-- IS — Iceland — 2 venues, 2 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('IS','Iceland',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Akureyri','IS','Iceland','Northeast','Akureyrarkaupstaður',65.68353,-18.0878,12,false,'community_review'),
  ('Reykjavík','IS','Iceland','Capital Region','Reykjavíkurborg',64.13548,-21.89541,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Borðtennis Bakarabrekkan','parc_exterior','Reykjavík','Reykjavíkurborg',NULL,'Lækjargata 3, Reykjavík',64.14672,-21.93651,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Borðtennis Birkivöllur','parc_exterior','Akureyri','Akureyrarkaupstaður',NULL,'Birkivöllur, Akureyri',65.64419,-18.08828,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='IS' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
