-- LV — Latvia — 37 venues, 21 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('LV','Latvia',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Ādaži','LV','Latvia','Ādaži','Ādažu novads',57.0708,24.33678,12,false,'community_review'),
  ('Baloži','LV','Latvia','Ķekava','Baloži',56.87643,24.11825,12,false,'community_review'),
  ('Berģi','LV','Latvia','Riga','Rīga',56.98639,24.29917,12,false,'community_review'),
  ('Iecava','LV','Latvia','Bauska Municipality','Iecavas pagasts',56.59766,24.20763,12,false,'community_review'),
  ('Jaunciems','LV','Latvia','Riga','Rīga',57.0391,24.17413,12,false,'community_review'),
  ('Jūrmala','LV','Latvia','Jūrmala','Jūrmala',56.968,23.77038,12,false,'community_review'),
  ('Kandava','LV','Latvia','Tukums Municipality','Kandava',57.04087,22.77466,12,false,'community_review'),
  ('Krāslava','LV','Latvia','Krāslava Municipality','Krāslava',55.89514,27.16799,12,false,'community_review'),
  ('Liepāja','LV','Latvia','Liepaja','Liepāja',56.50474,21.01085,12,false,'community_review'),
  ('Mārupe','LV','Latvia','Mārupe','Mārupes novads',56.90544,24.05113,12,false,'community_review'),
  ('Ogre','LV','Latvia','Ogre','Ogre',56.8162,24.61401,12,false,'community_review'),
  ('Olaine','LV','Latvia','Olaine','Olaine',56.79583,23.93726,12,false,'community_review'),
  ('Piņķi','LV','Latvia','Mārupe','Babītes pagasts',56.94189,23.91365,12,false,'community_review'),
  ('Pļaviņas','LV','Latvia','Aizkraukle Municipality','Pļaviņas',56.6178,25.72552,12,false,'community_review'),
  ('Priekuļi','LV','Latvia','Cēsis Municipality','Priekuļu pagasts',57.315,25.36147,12,false,'community_review'),
  ('Riga','LV','Latvia','Riga','Rīga',56.946,24.10589,12,false,'community_review'),
  ('Salaspils','LV','Latvia','Salaspils Municipality','Salaspils',56.86014,24.36544,12,false,'community_review'),
  ('Skrunda','LV','Latvia','Kuldīga Municipality','Skrunda',56.67749,22.01649,12,false,'community_review'),
  ('Ulbroka','LV','Latvia','Ropaži Municipality','Stopiņu pagasts',56.9363,24.30387,12,false,'community_review'),
  ('Valmiera','LV','Latvia','Valmiera','Valmiera',57.54108,25.42751,12,false,'community_review'),
  ('Vecrīga','LV','Latvia','Riga','Rīga',56.94966,24.10418,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Gaujas nacionālais parks','parc_exterior','Priekuļi','Priekuļu pagasts',NULL,'Skolas iela 1, Priekuļi',57.3099,25.35279,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Popkorna skvērs','parc_exterior','Olaine','Olaine',NULL,'Veselības iela 7, Olaine',56.78513,23.93379,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Carnikavas parks','parc_exterior','Ādaži','Ādažu novads',NULL,'Zvejnieku iela 3, Ādaži',57.13059,24.27328,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Aizsargājamo ainavu apvidus „Augšdaugava”','parc_exterior','Krāslava','Krāslava',NULL,'Aizsargājamo ainavu apvidus „Augšdaugava”, Krāslava',55.9108,26.88077,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Kr. Barona 97','parc_exterior','Vecrīga','Rīga',NULL,'Tallinas iela 57 k-2, Vecrīga',56.96065,24.14269,3,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Jaunelku iela','parc_exterior','Berģi','Rīga',NULL,'Jaunelku iela 9, Berģi',56.991095,24.21704,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Mazā Robežu iela','parc_exterior','Ulbroka','Stopiņu pagasts',NULL,'Mazā Robežu iela 3, Ulbroka',56.94672,24.24858,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Dambja iela','parc_exterior','Ulbroka','Stopiņu pagasts',NULL,'Dambja iela 3, Ulbroka',56.94849,24.35856,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Alekša skvērs','parc_exterior','Vecrīga','Rīga',NULL,'Alekša iela 12, Vecrīga',56.99391,24.1247,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Uzvaras parks','parc_exterior','Riga','Rīga',NULL,'Uzvaras bulvāris 15, Riga',56.935425,24.085495,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Višķu skvērs','parc_exterior','Baloži','Baloži',NULL,'Višķu iela 15, Baloži',56.90021,24.21093,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Spēļu un rekreācijas laukums Nīcgales ielā','parc_exterior','Riga','Rīga',NULL,'Nīcgales iela 8, Riga',56.95701,24.17531,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Aktīvās atpūtas un rotaļu laukumu zona Vidus prospektā 25','parc_exterior','Ogre','Ogre',NULL,'Vidus prospekts 25, Ogre',56.8243,24.583,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Ziemeļvalstu Ģimnāzija','parc_exterior','Mārupe','Mārupes novads',NULL,'Paula Lejiņa iela 10, Mārupe',56.94679,24.018705,4,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Rīgas 75. pamatskola','parc_exterior','Riga','Rīga',NULL,'Ogres iela 9, Riga',56.9273,24.1629233,3,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Silakroga sporta laukums','parc_exterior','Ulbroka','Stopiņu pagasts',NULL,'Silakroga iela 13, Ulbroka',56.96078,24.425335,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Rīgas Dārzciema vidusskola','parc_exterior','Riga','Rīga',NULL,'Akotu iela 14, Riga',56.945125,24.190425,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Reģionālais Sporta Centrs Sarkandaugava','parc_exterior','Jaunciems','Rīga',NULL,'Limbažu iela 6, Jaunciems',56.99936,24.1256,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Autostāvvieta zem tilta','parc_exterior','Vecrīga','Rīga',NULL,'Gustava Zemgala gatve 76, Vecrīga',56.977,24.16526,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('ALIVE Cheerleading team','parc_exterior','Riga','Rīga',NULL,'Kapseļu iela 4E, Riga',56.94189,24.06759,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Skultes bērnu laukums','parc_exterior','Piņķi','Babītes pagasts',NULL,'Skultes iela 14B, Piņķi',56.9183,23.9494,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Stick Fix','parc_exterior','Vecrīga','Rīga',NULL,'Tērbatas iela 97, Vecrīga',56.96162,24.13713,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Sportland Olimpia Outlet','parc_exterior','Vecrīga','Rīga',NULL,'Āzenes iela 5, Vecrīga',56.94976,24.08355,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Valmieras Skeitparks','parc_exterior','Valmiera','Valmiera',NULL,'Rīgas iela 43A, Valmiera',57.53629,25.40929,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Cebep Group','parc_exterior','Riga','Rīga',NULL,'Rudens iela 8, Riga',56.9373,24.19856,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Liepājas Skatepark','parc_exterior','Liepāja','Liepāja',NULL,'Jūrmalas iela 2, Liepāja',56.50126,20.99652,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Latgales iela','parc_exterior','Baloži','Baloži',NULL,'Latgales iela 260 k-7, Baloži',56.90716,24.17988,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Engures iela','parc_exterior','Jūrmala','Jūrmala',NULL,'Engures iela 5, Jūrmala',56.96024,23.59599,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Palsas iela','parc_exterior','Berģi','Rīga',NULL,'Palsas iela 30, Berģi',56.9758,24.2383,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Juglas iela','parc_exterior','Ulbroka','Stopiņu pagasts',NULL,'Juglas iela 20 k-1, Ulbroka',56.95954,24.25527,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Kalna iela','parc_exterior','Pļaviņas','Pļaviņas',NULL,'Kalna iela 2, Pļaviņas',56.69368,25.97259,1,false,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Zeltiņu iela','parc_exterior','Riga','Rīga',NULL,'Zeltiņu iela 25, Riga',56.94762,24.17039,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Latgales iela (2)','parc_exterior','Baloži','Baloži',NULL,'Latgales iela 256 k-5, Baloži',56.91134,24.17532,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Lielā iela','parc_exterior','Skrunda','Skrunda',NULL,'Lielā iela 2B, Skrunda',56.6768,22.01567,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Dienvidu iela','parc_exterior','Salaspils','Salaspils',NULL,'Dienvidu iela 7A, Salaspils',56.860035,24.369745,2,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Grāfa laukums','parc_exterior','Iecava','Iecavas pagasts',NULL,'Grāfa laukums 5, Iecava',56.5921267,24.2052067,3,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Abavas iela','parc_exterior','Kandava','Kandava',NULL,'Abavas iela 1, Kandava',57.03459,22.90778,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='LV' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
