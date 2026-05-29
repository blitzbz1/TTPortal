-- CY — Cyprus — 3 venues, 2 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('CY','Cyprus',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Limassol','CY','Cyprus','Limassol','Limassol',34.68406,33.03794,12,false,'community_review'),
  ('Trachóni','CY','Cyprus',NULL,NULL,34.65756,32.96534,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Table tennis Gauguin Park','parc_exterior','Trachóni',NULL,NULL,'Gauguin Park, Trachóni',34.65404,32.99873,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Gauguin Park (2)','parc_exterior','Trachóni',NULL,NULL,'Gauguin Park, Trachóni',34.65399,32.99872,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Limassol Nautical Club','parc_exterior','Limassol','Limassol',NULL,'Limassol Nautical Club, Limassol',34.68887,33.07185,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='CY' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
