-- IE — Ireland — 15 venues, 11 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('IE','Ireland',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Ballina','IE','Ireland','Munster','County Tipperary',52.80778,-8.43556,12,false,'community_review'),
  ('Blanchardstown','IE','Ireland','Leinster','Fingal County',53.38806,-6.37556,12,false,'community_review'),
  ('Blarney','IE','Ireland','Munster','County Cork',51.93333,-8.56667,12,false,'community_review'),
  ('Cabra','IE','Ireland','Leinster','Dublin City',53.36694,-6.29444,12,false,'community_review'),
  ('Foxrock','IE','Ireland','Leinster','Dún Laoghaire-Rathdown',53.26667,-6.17417,12,false,'community_review'),
  ('Glasnevin','IE','Ireland','Leinster','Dublin City',53.37851,-6.28028,12,false,'community_review'),
  ('Limerick','IE','Ireland','Munster','Limerick City and County Council',52.66472,-8.62306,12,false,'community_review'),
  ('Maynooth','IE','Ireland','Leinster','Kildare',53.385,-6.59361,12,false,'community_review'),
  ('Sandyford','IE','Ireland','Leinster','Dún Laoghaire-Rathdown',53.2747,-6.2253,12,false,'community_review'),
  ('Tallaght','IE','Ireland','Leinster','South Dublin',53.2859,-6.37344,12,false,'community_review'),
  ('Tralee','IE','Ireland','Munster','Kerry',52.27042,-9.70264,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('PingZone Table Tennis Club & Equipment','parc_exterior','Sandyford','Dún Laoghaire-Rathdown',NULL,'St Benildus College, Sandyford',53.28432,-6.22269,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table Tennis','parc_exterior','Maynooth','Kildare',NULL,'Maynooth University North Campus, Maynooth',53.38393,-6.60274,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Albert College Park','parc_exterior','Glasnevin','Dublin City',NULL,'Albert College Park, Glasnevin',53.38353,-6.26046,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Clay Farm','parc_exterior','Foxrock','Dún Laoghaire-Rathdown',NULL,'Clay Farm, Foxrock',53.25532,-6.20281,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Hamilton Gardens','parc_exterior','Cabra','Dublin City',NULL,'Hamilton Gardens, Cabra',53.36413,-6.29261,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Hamilton Gardens (2)','parc_exterior','Cabra','Dublin City',NULL,'Hamilton Gardens, Cabra',53.36412,-6.29253,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Q-Park Exchange Hall','parc_exterior','Tallaght','South Dublin',NULL,'Q-Park Exchange Hall, Tallaght',53.29102,-6.37263,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Q-Park Exchange Hall (2)','parc_exterior','Tallaght','South Dublin',NULL,'Q-Park Exchange Hall, Tallaght',53.29096,-6.37268,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis NAC Swim Club','parc_exterior','Blanchardstown','Fingal County',NULL,'NAC Swim Club, Blanchardstown',53.39593,-6.36896,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis NAC Swim Club (2)','parc_exterior','Blanchardstown','Fingal County',NULL,'NAC Swim Club, Blanchardstown',53.39578,-6.36895,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Woodlands Park','parc_exterior','Tralee','Kerry',NULL,'Woodlands Park, Tralee',52.26214,-9.70497,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Lakeside Holiday Park','parc_exterior','Ballina','County Tipperary',NULL,'Lakeside Holiday Park, Ballina',52.92771,-8.41896,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Blarney Playground','parc_exterior','Blarney','County Cork',NULL,'Blarney Playground, Blarney',51.92872,-8.55701,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Blarney Playground (2)','parc_exterior','Blarney','County Cork',NULL,'Blarney Playground, Blarney',51.92872,-8.55696,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Shannon Rowing Club','parc_exterior','Limerick','Limerick City and County Council',NULL,'Shannon Rowing Club, Limerick',52.6652,-8.6287,1,true,true,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='IE' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
