-- TR — Turkey — 23 venues, 16 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('TR','Turkey',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Ağva','TR','Turkey','Istanbul','Şile',41.13806,29.85667,12,false,'community_review'),
  ('Antalya','TR','Turkey','Antalya','Antalya',36.90812,30.69556,12,false,'community_review'),
  ('Başakşehir','TR','Turkey','Istanbul','Başakşehir',41.106,28.791,12,false,'community_review'),
  ('Beldibi','TR','Turkey','Antalya','Konyaaltı',36.71921,30.56379,12,false,'community_review'),
  ('Belek','TR','Turkey','Antalya','Serik',36.8631,31.06541,12,false,'community_review'),
  ('Çerkezköy','TR','Turkey','Tekirdağ','Çerkezköy',41.28629,27.99939,12,false,'community_review'),
  ('Cikcilli','TR','Turkey','Antalya','Alanya',36.55403,32.02962,12,false,'community_review'),
  ('Esenyurt','TR','Turkey','Istanbul','Esenyurt',41.02697,28.67732,12,false,'community_review'),
  ('Etimesgut','TR','Turkey','Ankara','Etimesgut İlçesi',39.95328,32.63285,12,false,'community_review'),
  ('İçmeler','TR','Turkey','Istanbul','Tuzla',40.84639,29.30889,12,false,'community_review'),
  ('Kapaklı','TR','Turkey','Tekirdağ','Kapaklı',41.32912,27.98064,12,false,'community_review'),
  ('Kumköy','TR','Turkey','Antalya','Serik',36.88286,30.95178,12,false,'community_review'),
  ('Nilüfer','TR','Turkey','Bursa Province','Nilüfer',40.21401,28.91567,12,false,'community_review'),
  ('Sultangazi','TR','Turkey','Istanbul','Sultangazi',41.10652,28.86847,12,false,'community_review'),
  ('Üsküdar','TR','Turkey','Istanbul','Üsküdar',41.02274,29.01366,12,false,'community_review'),
  ('Yakuplu','TR','Turkey','Istanbul','Beylikdüzü',40.98894,28.67582,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Masa tenisi Ela Quality Four Ways Square','parc_exterior','Belek','Serik',NULL,'Ela Quality Four Ways Square, Belek',36.85417,31.04243,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Kapalı Tenis Kortu','parc_exterior','Kapaklı','Kapaklı',NULL,'Kapaklı, Kapaklı',41.31776,27.9686,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Karayolları Parkı','parc_exterior','Cikcilli','Alanya',NULL,'Karayolları Parkı, Cikcilli',36.54013,32.02426,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Tenis Masası','parc_exterior','Çerkezköy','Çerkezköy',NULL,'Çerkezköy, Çerkezköy',41.28168,27.98683,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Yoğurtçu Parkı','parc_exterior','Üsküdar','Üsküdar',NULL,'Yoğurtçu Parkı, Üsküdar',40.98488,29.03355,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Avcılar Sahil Yolu','parc_exterior','Yakuplu','Beylikdüzü',NULL,'Avcılar Sahil Yolu, Yakuplu',40.97232,28.74278,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Avcılar Sahil Yolu (2)','parc_exterior','Yakuplu','Beylikdüzü',NULL,'Avcılar Sahil Yolu, Yakuplu',40.97238,28.74276,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Avcılar Sahil Yolu (3)','parc_exterior','Yakuplu','Beylikdüzü',NULL,'Avcılar Sahil Yolu, Yakuplu',40.97259,28.74288,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Yaşam Vadisi','parc_exterior','İçmeler','Tuzla',NULL,'Yaşam Vadisi, İçmeler',40.83483,29.31249,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Yaşam Vadisi (2)','parc_exterior','İçmeler','Tuzla',NULL,'Yaşam Vadisi, İçmeler',40.83475,29.31258,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Dostluk Parkı','parc_exterior','Etimesgut','Etimesgut İlçesi',NULL,'Dostluk Parkı, Etimesgut',39.96482,32.73021,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Dostluk Parkı (2)','parc_exterior','Etimesgut','Etimesgut İlçesi',NULL,'Dostluk Parkı, Etimesgut',39.96477,32.7302,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Dostluk Parkı (3)','parc_exterior','Etimesgut','Etimesgut İlçesi',NULL,'Dostluk Parkı, Etimesgut',39.96472,32.73018,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Pınarça Dere Kenarı Park','parc_exterior','Çerkezköy','Çerkezköy',NULL,'Pınarça Dere Kenarı Park, Çerkezköy',41.28807,28.00729,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('2 Tables','parc_exterior','Beldibi','Konyaaltı',NULL,'Beldibi',36.71039,30.57013,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Ağva Kıyı Rekreasyon Alanı Parkı','parc_exterior','Ağva','Şile',NULL,'Ağva Kıyı Rekreasyon Alanı Parkı, Ağva',41.13726,29.84977,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Voyage Belek Golf & Spa','parc_exterior','Belek','Serik',NULL,'Voyage Belek Golf & Spa, Belek',36.84747,31.07393,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Bahçeşehir Doğa Parkı','parc_exterior','Esenyurt','Esenyurt',NULL,'Bahçeşehir Doğa Parkı, Esenyurt',41.06443,28.69745,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Swandor Topkapı Palace','parc_exterior','Kumköy','Serik',NULL,'Swandor Topkapı Palace, Kumköy',36.8564,30.91542,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Hamitler Spor Parkı','parc_exterior','Nilüfer','Nilüfer',NULL,'Hamitler Spor Parkı, Nilüfer',40.25066,28.99126,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Başakşehir Sular Vadisi','parc_exterior','Başakşehir','Başakşehir',NULL,'Başakşehir Sular Vadisi, Başakşehir',41.11245,28.80654,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Atatürk Kültür Parkı','parc_exterior','Antalya','Antalya',NULL,'Atatürk Kültür Parkı, Antalya',36.88527,30.67309,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Masa tenisi Şht. Ahmet Tepeli Parkı','parc_exterior','Sultangazi','Sultangazi',NULL,'Şht. Ahmet Tepeli Parkı, Sultangazi',41.10415,28.86584,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='TR' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
