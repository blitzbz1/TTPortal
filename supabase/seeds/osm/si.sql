-- SI — Slovenia — 34 venues, 16 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('SI','Slovenia',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Ankaran','SI','Slovenia','Municipality of Ankaran','Municipality of Ankaran',45.57902,13.73616,12,false,'community_review'),
  ('Bled','SI','Slovenia','Municipality of Bled','Municipality of Bled',46.36859,14.11652,12,false,'community_review'),
  ('Brezovica pri Ljubljani','SI','Slovenia','Municipality of Brezovica','Rudnik District',46.0233,14.41499,12,false,'community_review'),
  ('Divača','SI','Slovenia','Municipality of Divača','Municipality of Divača',45.6848,13.9705,12,false,'community_review'),
  ('Hrastnik','SI','Slovenia','Municipality of Hrastnik','Municipality of Hrastnik',46.14655,15.08456,12,false,'community_review'),
  ('Idrija','SI','Slovenia','Municipality of Idrija','Municipality of Idrija',46.00295,14.02787,12,false,'community_review'),
  ('Izlake','SI','Slovenia','Municipality of Zagorje ob Savi','Municipality of Zagorje ob Savi',46.15,14.95,12,false,'community_review'),
  ('Izola','SI','Slovenia','Municipality of Izola','Municipality of Izola',45.53661,13.66015,12,false,'community_review'),
  ('Kobarid','SI','Slovenia','Municipality of Kobarid','Municipality of Kobarid',46.24761,13.57907,12,false,'community_review'),
  ('Ljubljana','SI','Slovenia','Ljubljana','Ljubljana',46.05108,14.50513,12,false,'community_review'),
  ('Lucija','SI','Slovenia','Municipality of Piran','Municipality of Piran',45.50526,13.6024,12,false,'community_review'),
  ('Mojstrana','SI','Slovenia','Municipality of Kranjska Gora','Municipality of Kranjska Gora',46.42383,13.8752,12,false,'community_review'),
  ('Nova Gorica','SI','Slovenia','Urban Municipality of Nova Gorica','Urban Municipality of Nova Gorica',45.95604,13.64837,12,false,'community_review'),
  ('Pekre','SI','Slovenia','Urban Municipality of Maribor','Urban Municipality of Maribor',46.54722,15.59556,12,false,'community_review'),
  ('Rečica ob Savinji','SI','Slovenia','Municipality of Rečica ob Savinji','Municipality of Rečica ob Savinji',46.31667,14.91667,12,false,'community_review'),
  ('Zabukovica','SI','Slovenia','Municipality of Žalec','Municipality of Žalec',46.21408,15.15954,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Osnovna šola Riharda Jakopiča','parc_exterior','Ljubljana','Ljubljana',NULL,'Vodnikova cesta 56a, Ljubljana',46.06752,14.488315,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Osnovna šola Franceta Bevka','parc_exterior','Ljubljana','Ljubljana',NULL,'Ulica Pohorskega bataljona 1, Ljubljana',46.077885,14.50678,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Osnovna šola Valentina Vodnika','parc_exterior','Ljubljana','Ljubljana',NULL,'Vodnikova cesta 162, Ljubljana',46.074185,14.47676,2,false,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Park Ade Škerl in Sonje Plaskan','parc_exterior','Ljubljana','Ljubljana',NULL,'Cimpermanova ulica 4, Ljubljana',46.043395,14.50884,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('NTK Arrigoni Izola','parc_exterior','Izola','Municipality of Izola',NULL,'Dantejeva ulica 18, Izola',45.53262,13.65465,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Gosarjeva ulica','parc_exterior','Ljubljana','Ljubljana',NULL,'Gosarjeva ulica 5, Ljubljana',46.07425,14.51576,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Lokev','parc_exterior','Divača','Municipality of Divača',NULL,'Lokev 140, Divača',45.66065,13.92932,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Šarhova ulica','parc_exterior','Ljubljana','Ljubljana',NULL,'Šarhova ulica 6, Ljubljana',46.0792,14.5093,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Kamnogoriška cesta','parc_exterior','Ljubljana','Ljubljana',NULL,'Kamnogoriška cesta 47, Ljubljana',46.07868,14.46584,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Kmetija Tratnik Kamp','parc_exterior','Zabukovica','Municipality of Žalec',NULL,'Pongrac 165, Zabukovica',46.19757,15.17046,1,true,false,NULL,'Kmetija Tratnik Kamp',ARRAY['exterior'],true,false),
  ('ProDive','parc_exterior','Pekre','Urban Municipality of Maribor',NULL,'Borova vas 7, Pekre',46.543625,15.619675,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Menina','parc_exterior','Rečica ob Savinji','Municipality of Rečica ob Savinji',NULL,'Varpolje 105, Rečica ob Savinji',46.31172,14.90877,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Kamp Koren','parc_exterior','Kobarid','Municipality of Kobarid',NULL,'Ladra 1b, Kobarid',46.24958,13.58717,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('River Camping Bled','parc_exterior','Bled','Municipality of Bled',NULL,'Alpska cesta 111, Bled',46.36651,14.135105,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Lukmar Prevozi Transport in Logistika','parc_exterior','Izlake','Municipality of Zagorje ob Savi',NULL,'Izlake 3, Izlake',46.15391,14.929095,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Grajski Park Fužine','parc_exterior','Ljubljana','Ljubljana',NULL,'Rusjanov trg 5, Ljubljana',46.05161,14.56235,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Društvo za Šport in Rekreacijo Škorpijoni Hrastnik','parc_exterior','Hrastnik','Municipality of Hrastnik',NULL,'Log 19, Hrastnik',46.14432,15.08259,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Kegljaški klub Rudnik Hrastnik','parc_exterior','Hrastnik','Municipality of Hrastnik',NULL,'Log 19, Hrastnik',46.14354,15.08361,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Iglu šport Idrija','parc_exterior','Idrija','Municipality of Idrija',NULL,'Rožna ulica 2a, Idrija',46.00123,14.02349,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Baloni park - pravljicna dezela','parc_exterior','Lucija','Municipality of Piran',NULL,'Obala 24, Lucija',45.50781,13.59631,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Belca','parc_exterior','Mojstrana','Municipality of Kranjska Gora',NULL,'Belca 19g, Mojstrana',46.47263,13.90719,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Športni park Bratovševa','parc_exterior','Ljubljana','Ljubljana',NULL,'Slovenčeva ulica 149, Ljubljana',46.08852,14.5081,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Gimnazija Moste','parc_exterior','Ljubljana','Ljubljana',NULL,'Zaloška cesta 51, Ljubljana',46.05607,14.53274,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Športni park Kodeljevo','parc_exterior','Ljubljana','Ljubljana',NULL,'Ulica Carla Benza 16, Ljubljana',46.04953,14.531855,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Osnovna Šola Oskarja Kovačiča','parc_exterior','Ljubljana','Ljubljana',NULL,'Vandotova ulica 6, Ljubljana',46.032885,14.522135,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Park Muste','parc_exterior','Ljubljana','Ljubljana',NULL,'Ulica Mire Miheličeve 13, Ljubljana',46.05426,14.54826,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Na krogih','parc_exterior','Nova Gorica','Urban Municipality of Nova Gorica',NULL,'Ulica Gradnikove brigade 15, Nova Gorica',45.95934,13.64576,4,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Kitajski zid','parc_exterior','Nova Gorica','Urban Municipality of Nova Gorica',NULL,'Ulica Gradnikove brigade 25, Nova Gorica',45.96051,13.64618,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Osnovna šola Vrhovci','parc_exterior','Brezovica pri Ljubljani','Rudnik District',NULL,'Cesta na Vrhovce 67, Brezovica pri Ljubljani',46.04498,14.45351,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Camping Adria Ankaran','parc_exterior','Ankaran','Municipality of Ankaran',NULL,'Jadranska cesta 25, Ankaran',45.5783,13.73238,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('ŽAK','parc_exterior','Ljubljana','Ljubljana',NULL,'Milčinskega ulica 1, Ljubljana',46.07073,14.497205,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('VELO Slovenija','parc_exterior','Ljubljana','Ljubljana',NULL,'Tugomerjeva ulica 4, Ljubljana',46.07264,14.48522,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Pro Sports Services','parc_exterior','Ljubljana','Ljubljana',NULL,'Mislejeva ulica 3, Ljubljana',46.06471,14.5242,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Brejčeva ulica','parc_exterior','Ljubljana','Ljubljana',NULL,'Brejčeva ulica 2, Ljubljana',46.04774,14.517885,2,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='SI' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
