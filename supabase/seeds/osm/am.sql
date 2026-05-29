-- AM — Armenia — 4 venues, 4 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('AM','Armenia',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Argavand','AM','Armenia','Ararat','Masis Municipality',40.15289,44.4389,12,false,'community_review'),
  ('Dilijan','AM','Armenia','Tavush','Dilijan Municipality',40.74037,44.86344,12,false,'community_review'),
  ('Gugark','AM','Armenia','Lori','Vanadzor Municipality',40.8046,44.54025,12,false,'community_review'),
  ('Yerevan','AM','Armenia','Yerevan','Yerevan',40.17765,44.5126,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Table tennis Shoghakat Park','parc_exterior','Argavand','Masis Municipality',NULL,'Shoghakat Park, Argavand',40.15005,44.47921,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Հաղթանակի զբոսայգի','parc_exterior','Yerevan','Yerevan',NULL,'Հաղթանակի զբոսայգի, Yerevan',40.1956,44.51949,1,false,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Էկոկայան Դիլիջան Ռեզորտ Հոթել','parc_exterior','Dilijan','Dilijan Municipality',NULL,'Էկոկայան Դիլիջան Ռեզորտ Հոթել, Dilijan',40.75696,44.85149,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Աշխատանքային Ռեզերվներ','parc_exterior','Gugark','Vanadzor Municipality',NULL,'Gugark',40.80065,44.5199,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='AM' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
