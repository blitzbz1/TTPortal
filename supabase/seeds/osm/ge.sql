-- GE — Georgia — 17 venues, 7 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('GE','Georgia',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Batumi','GE','Georgia','Adjara','Adjara',41.64077,41.6306,12,false,'community_review'),
  ('Dighomi','GE','Georgia','Tbilisi','Tbilisi',41.77278,44.73208,12,false,'community_review'),
  ('Gudauri','GE','Georgia','Mtskheta-Mtianeti','Mtskheta-Mtianeti',42.47797,44.47616,12,false,'community_review'),
  ('Kutaisi','GE','Georgia','Imereti','Imereti',42.26791,42.69459,12,false,'community_review'),
  ('Okroq’ana','GE','Georgia','Tbilisi','Tbilisi',41.68738,44.77355,12,false,'community_review'),
  ('Poti','GE','Georgia','Samegrelo and Zemo Svaneti','Poti Municipality',42.14272,41.67384,12,false,'community_review'),
  ('Tsqnet’i','GE','Georgia','Kvemo Kartli','Kvemo Kartli',41.69472,44.69861,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Table tennis Gudauri Ski Resort','parc_exterior','Gudauri','Mtskheta-Mtianeti',NULL,'Gudauri Ski Resort, Gudauri',42.4611,44.48436,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis ვაკის პარკი (2)','parc_exterior','Okroq’ana','Tbilisi',NULL,'ვაკის პარკი, Okroq’ana',41.70964,44.7501,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis 6 მაისი პარკი','parc_exterior','Batumi','Adjara',NULL,'6 მაისი პარკი, Batumi',41.64902,41.62751,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis ლისი რეკრეაცია','parc_exterior','Dighomi','Tbilisi',NULL,'ლისი რეკრეაცია, Dighomi',41.73988,44.74252,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Mantra','parc_exterior','Tsqnet’i','Kvemo Kartli',NULL,'Mantra, Tsqnet’i',41.72341,44.70403,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis ფოთის ცენტრალური პარკი • Poti Central Park','parc_exterior','Poti','Poti Municipality',NULL,'ფოთის ცენტრალური პარკი • Poti Central Park, Poti',42.14039,41.67453,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis შენი სახლი უნივერსიტეტის ქუჩაზე','parc_exterior','Tsqnet’i','Kvemo Kartli',NULL,'შენი სახლი უნივერსიტეტის ქუჩაზე, Tsqnet’i',41.71662,44.72671,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis შენი სახლი უნივერსიტეტის ქუჩაზე (2)','parc_exterior','Tsqnet’i','Kvemo Kartli',NULL,'შენი სახლი უნივერსიტეტის ქუჩაზე, Tsqnet’i',41.71662,44.72677,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Gelovani Park','parc_exterior','Tsqnet’i','Kvemo Kartli',NULL,'Gelovani Park, Tsqnet’i',41.72525,44.73717,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Gelovani Park (2)','parc_exterior','Tsqnet’i','Kvemo Kartli',NULL,'Gelovani Park, Tsqnet’i',41.72522,44.73719,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('მეჩ ფოინთ პინგ-პონგის კლუბი','parc_exterior','Tsqnet’i','Kvemo Kartli',NULL,'35th Football School • 35-ე საფეხბურთო სკოლა, Tsqnet’i',41.72229,44.73689,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis ვაკის პარკი (3)','parc_exterior','Okroq’ana','Tbilisi',NULL,'ვაკის პარკი, Okroq’ana',41.70966,44.75004,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis ილიას ბაღი','parc_exterior','Okroq’ana','Tbilisi',NULL,'ილიას ბაღი, Okroq’ana',41.70836,44.80021,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Free table tennis in School','parc_exterior','Kutaisi','Imereti',NULL,'ბალახვანი, Kutaisi',42.26493,42.70672,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis მიროს პარკი','parc_exterior','Okroq’ana','Tbilisi',NULL,'მიროს პარკი, Okroq’ana',41.71971,44.7681,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis მიროს პარკი (2)','parc_exterior','Okroq’ana','Tbilisi',NULL,'მიროს პარკი, Okroq’ana',41.71972,44.76814,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis ვაკის პარკი','parc_exterior','Okroq’ana','Tbilisi',NULL,'ვაკის პარკი, Okroq’ana',41.70965,44.75009,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='GE' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
