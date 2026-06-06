-- BY — Belarus — 37 venues, 18 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('BY','Belarus',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Brest','BY','Belarus','Brest','Brest',52.10894,23.71749,12,false,'community_review'),
  ('Hrodna','BY','Belarus','Grodnenskaya','Grodnenskaya',53.6758,23.82887,12,false,'community_review'),
  ('Kalodzishchy','BY','Belarus','Minsk','Minsk',53.944,27.7823,12,false,'community_review'),
  ('Krasnaye','BY','Belarus','Minsk','Minskiy Rayon',54.2438,27.0758,12,false,'community_review'),
  ('Maladziečna','BY','Belarus','Minsk','Minsk',54.3167,26.854,12,false,'community_review'),
  ('Minsk','BY','Belarus','Minsk City','Minsk City',53.90019,27.56653,12,false,'community_review'),
  ('Mir','BY','Belarus','Grodnenskaya','Grodnenskaya',53.4544,26.467,12,false,'community_review'),
  ('Orsha','BY','Belarus','Vitebsk','Vitebsk',54.51362,30.40365,12,false,'community_review'),
  ('Pryvol’ny','BY','Belarus','Minsk','Minsk',53.7969,27.7967,12,false,'community_review'),
  ('Schomyslitsa','BY','Belarus','Minsk','Minsk',53.8211,27.4522,12,false,'community_review'),
  ('Sonechny','BY','Belarus','Minsk','Minskiy Rayon',53.97041,27.62137,12,false,'community_review'),
  ('Syenitsa','BY','Belarus','Minsk','Minsk',53.8313,27.5343,12,false,'community_review'),
  ('Vidzy','BY','Belarus','Vitebsk','Vitebsk',55.3945,26.6305,12,false,'community_review'),
  ('Vitebsk','BY','Belarus','Vitebsk','Vitebsk',55.1904,30.2049,12,false,'community_review'),
  ('Vyaliki Trastsyanets','BY','Belarus','Minsk','Minsk',53.851,27.7139,12,false,'community_review'),
  ('Zaslawye','BY','Belarus','Minsk','Minsk',54.0114,27.2695,12,false,'community_review'),
  ('Zhdanovichy','BY','Belarus','Minsk','Minsk',53.9432,27.425,12,false,'community_review'),
  ('Zhlobin','BY','Belarus','Homyel’ Voblasc’','Homyel’ Voblasc’',52.8926,30.024,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Настольный теннис Каменная Горка-3','parc_exterior','Zhdanovichy','Minsk',NULL,'Каменная Горка-3, Zhdanovichy',53.93205,27.42895,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Кедравы квартал','parc_exterior','Sonechny','Minskiy Rayon',NULL,'Кедравы квартал, Sonechny',53.954025,27.66583,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Каменная Горка-3 (2)','parc_exterior','Zhdanovichy','Minsk',NULL,'Каменная Горка-3, Zhdanovichy',53.93262,27.43386,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Лошыца-9','parc_exterior','Syenitsa','Minsk',NULL,'Лошыца-9, Syenitsa',53.83697,27.5908967,3,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Каменная Горка-3 (3)','parc_exterior','Zhdanovichy','Minsk',NULL,'Каменная Горка-3, Zhdanovichy',53.92924,27.42897,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Тэнісны стол','parc_exterior','Sonechny','Minskiy Rayon',NULL,'Севастопальскі парк, Sonechny',53.938205,27.634065,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Захад-4','parc_exterior','Zhdanovichy','Minsk',NULL,'Захад-4, Zhdanovichy',53.894455,27.45944,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Чыжоўка-5','parc_exterior','Vyaliki Trastsyanets','Minsk',NULL,'Чыжоўка-5, Vyaliki Trastsyanets',53.84325,27.64436,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис мікрараён Поўдзень-5','parc_exterior','Vitebsk','Vitebsk',NULL,'мікрараён Поўдзень-5, Vitebsk',55.165355,30.207785,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис 9-ы кіламетр','parc_exterior','Kalodzishchy','Minsk',NULL,'9-ы кіламетр, Kalodzishchy',53.95985,27.73914,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Аквапарк','parc_exterior','Maladziečna','Minsk',NULL,'Аквапарк, Maladziečna',54.3015,26.86521,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис остановка Сёмково','parc_exterior','Minsk','Minsk City',NULL,'остановка Сёмково, Minsk',53.914105,27.53544,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('СДЮШАР № 8','parc_exterior','Vitebsk','Vitebsk',NULL,'Vitebsk',55.17646,30.20036,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Гімназія №2','parc_exterior','Kalodzishchy','Minsk',NULL,'Гімназія №2, Kalodzishchy',53.9437767,27.69578,3,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Брылевічы-2','parc_exterior','Schomyslitsa','Minsk',NULL,'Брылевічы-2, Schomyslitsa',53.8509,27.47782,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис БДАМ, навучальны корпус № 5','parc_exterior','Minsk','Minsk City',NULL,'БДАМ, навучальны корпус № 5, Minsk',53.88154,27.60932,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Серабранка-9','parc_exterior','Minsk','Minsk City',NULL,'Серабранка-9, Minsk',53.86799,27.59288,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Каменная Горка-3 (4)','parc_exterior','Zhdanovichy','Minsk',NULL,'Каменная Горка-3, Zhdanovichy',53.928255,27.43748,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Сярэдняя школа №73','parc_exterior','Minsk','Minsk City',NULL,'Сярэдняя школа №73, Minsk',53.9276175,27.60237,4,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Сярэдняя школа №42','parc_exterior','Hrodna','Grodnenskaya',NULL,'Сярэдняя школа №42, Hrodna',53.722045,23.874915,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Зялёны Луг-6','parc_exterior','Sonechny','Minskiy Rayon',NULL,'Зялёны Луг-6, Sonechny',53.96087,27.61469,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Спартзалу АФУТ','parc_exterior','Orsha','Vitebsk',NULL,'Аршанскі каледж — філіял УА «Беларускі дзяржаўны універсітэт транспарту», Orsha',54.51141,30.36048,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис ДАЛ «Лясны агеньчык»','parc_exterior','Pryvol’ny','Minsk',NULL,'ДАЛ «Лясны агеньчык», Pryvol’ny',53.80713,27.736025,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Фізкультурна-аздараўленчы комплекс','parc_exterior','Hrodna','Grodnenskaya',NULL,'Фізкультурна-аздараўленчы комплекс, Hrodna',53.68657,23.79031,1,false,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Парк Перамогі','parc_exterior','Minsk','Minsk City',NULL,'Парк Перамогі, Minsk',53.92634,27.53605,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Серабранка-8','parc_exterior','Minsk','Minsk City',NULL,'Серабранка-8, Minsk',53.87005,27.59331,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Санаторый «Зялёны Бор»','parc_exterior','Zaslawye','Minsk',NULL,'Санаторый «Зялёны Бор», Zaslawye',53.9646114,27.2786029,7,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Брылевічы-2 (2)','parc_exterior','Schomyslitsa','Minsk',NULL,'Брылевічы-2, Schomyslitsa',53.84983,27.48115,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Дзіцячы аздараўленчы лагер «Лясны»','parc_exterior','Krasnaye','Minskiy Rayon',NULL,'Дзіцячы аздараўленчы лагер «Лясны», Krasnaye',54.2528,27.01601,3,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Тры Мядзведзя','parc_exterior','Vidzy','Vitebsk',NULL,'Тры Мядзведзя, Vidzy',55.37856,26.8184,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис ОАО МинскСортСемОвощ','parc_exterior','Minsk','Minsk City',NULL,'ОАО МинскСортСемОвощ, Minsk',53.8851,27.51483,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Остановка «Площадь Ванеева»','parc_exterior','Minsk','Minsk City',NULL,'Остановка «Площадь Ванеева», Minsk',53.87981,27.60895,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Гімназія №31','parc_exterior','Zhdanovichy','Minsk',NULL,'Гімназія №31, Zhdanovichy',53.89738,27.42776,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Мірскі дзяржаўны мастацкі прафесійна-тэхнічны каледж','parc_exterior','Mir','Grodnenskaya',NULL,'Мірскі дзяржаўны мастацкі прафесійна-тэхнічны каледж, Mir',53.45202,26.47982,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Ёлка','parc_exterior','Brest','Brest',NULL,'Ёлка, Brest',52.10127,23.76729,1,true,false,'24/7',NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис Остановка «Молодежная»','parc_exterior','Brest','Brest',NULL,'Остановка «Молодежная», Brest',52.104595,23.75283,2,true,false,'24/7',NULL,ARRAY['exterior'],true,false),
  ('Настольный теннис 17-ы мікрараён','parc_exterior','Zhlobin','Homyel’ Voblasc’',NULL,'17-ы мікрараён, Zhlobin',52.90843,30.04862,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='BY' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
