-- GR — Greece — 34 venues, 23 cities
-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.
-- STAGED: cities active=false, expansion_status='community_review' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.
BEGIN;
INSERT INTO countries (code,name,active) VALUES ('GR','Greece',true) ON CONFLICT (code) DO NOTHING;
INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES
  ('Agios Dimitrios','GR','Greece','Attica','Nomarchía Athínas',37.93333,23.73333,12,false,'community_review'),
  ('Álimos','GR','Greece','Attica','Nomarchía Athínas',37.91033,23.72361,12,false,'community_review'),
  ('Argási','GR','Greece','Ionian Islands','Nomós Zakýnthou',37.76251,20.92357,12,false,'community_review'),
  ('Argyroúpoli','GR','Greece','Attica','Nomarchía Athínas',37.90594,23.75035,12,false,'community_review'),
  ('Chaniá','GR','Greece','Crete','Nomós Chaniás',35.51124,24.02921,12,false,'community_review'),
  ('Flórina','GR','Greece','West Macedonia','Nomós Florínis',40.78197,21.40981,12,false,'community_review'),
  ('Galátsi','GR','Greece','Attica','Nomarchía Athínas',38.01667,23.75,12,false,'community_review'),
  ('Georgioupolis','GR','Greece','Crete','Nomós Chaniás',35.36225,24.26013,12,false,'community_review'),
  ('Gýtheio','GR','Greece','Peloponnese','Nomós Lakonías',36.755,22.56417,12,false,'community_review'),
  ('Ilioúpoli','GR','Greece','Attica','Nomarchía Athínas',37.93149,23.76779,12,false,'community_review'),
  ('Kassándreia','GR','Greece','Central Macedonia','Nomós Chalkidikís',40.04835,23.41362,12,false,'community_review'),
  ('Kontokáli','GR','Greece','Ionian Islands','Nomós Kerkýras',39.64436,19.85194,12,false,'community_review'),
  ('Limín Khersonísou','GR','Greece','Crete','Heraklion Regional Unit',35.32297,25.39275,12,false,'community_review'),
  ('Moskháton','GR','Greece','Attica','Nomarchía Athínas',37.94789,23.6788,12,false,'community_review'),
  ('Néa Fókaia','GR','Greece','Central Macedonia','Nomós Chalkidikís',40.13333,23.39754,12,false,'community_review'),
  ('Oraiókastro','GR','Greece','Central Macedonia','Nomós Thessaloníkis',40.73083,22.91722,12,false,'community_review'),
  ('Pánormos','GR','Greece','Crete','Nomós Rethýmnis',35.41815,24.69091,12,false,'community_review'),
  ('Pithári','GR','Greece','Crete','Nomós Chaniás',35.51672,24.08653,12,false,'community_review'),
  ('Pylí','GR','Greece','South Aegean','Dodecanese',36.84472,27.15932,12,false,'community_review'),
  ('Témeni','GR','Greece','West Greece','Nomós Achaḯas',38.23707,22.12533,12,false,'community_review'),
  ('Thessaloníki','GR','Greece','Central Macedonia','Nomós Thessaloníkis',40.64072,22.93493,12,false,'community_review'),
  ('Tríkala','GR','Greece','Thessaly','Trikala',39.55493,21.76837,12,false,'community_review'),
  ('Zográfos','GR','Greece','Attica','Nomarchía Athínas',37.97574,23.76911,12,false,'community_review')
ON CONFLICT (country_code,name) DO NOTHING;
INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)
SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL
FROM (VALUES
  ('Table tennis 1η Κοινότητα Θεσσαλονίκης','parc_exterior','Thessaloníki','Nomós Thessaloníkis',NULL,'1η Κοινότητα Θεσσαλονίκης, Thessaloníki',40.6311,22.95228,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Όμιλος Επιτραπέζιας Αντισφαίρισης Θεσσαλονίκησ','parc_exterior','Oraiókastro','Nomós Thessaloníkis',NULL,'Φοίνικος, Oraiókastro',40.73194,22.91498,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Κέντρο Πολιτισμού Ίδρυμα Σταύρος Νιάρχος','parc_exterior','Moskháton','Nomarchía Athínas',NULL,'Κέντρο Πολιτισμού Ίδρυμα Σταύρος Νιάρχος, Moskháton',37.94172,23.69043,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Κέντρο Πολιτισμού Ίδρυμα Σταύρος Νιάρχος (2)','parc_exterior','Moskháton','Nomarchía Athínas',NULL,'Κέντρο Πολιτισμού Ίδρυμα Σταύρος Νιάρχος, Moskháton',37.94174,23.69047,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Αθλητικό Πάρκο Αγ. Γεωργίου','parc_exterior','Tríkala','Trikala',NULL,'Αθλητικό Πάρκο Αγ. Γεωργίου, Tríkala',39.54442,21.78752,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Αθλητικό Πάρκο Αγ. Γεωργίου (2)','parc_exterior','Tríkala','Trikala',NULL,'Αθλητικό Πάρκο Αγ. Γεωργίου, Tríkala',39.54441,21.78754,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Grecotel Corfu Imperial','parc_exterior','Kontokáli','Nomós Kerkýras',NULL,'Grecotel Corfu Imperial, Kontokáli',39.66713,19.86032,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Tropical','parc_exterior','Kassándreia','Nomós Chalkidikís',NULL,'Tropical, Kassándreia',39.98524,23.39085,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Meltemi','parc_exterior','Gýtheio','Nomós Lakonías',NULL,'Meltemi, Gýtheio',36.72942,22.55445,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Periyali Crèche & Children''s Club','parc_exterior','Argási','Nomós Zakýnthou',NULL,'Periyali Crèche & Children''s Club, Argási',37.71091,20.98909,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Periyali Crèche & Children''s Club (2)','parc_exterior','Argási','Nomós Zakýnthou',NULL,'Periyali Crèche & Children''s Club, Argási',37.71096,20.98914,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Άλσος Λαϊκής Κυριαρχίας','parc_exterior','Álimos','Nomarchía Athínas',NULL,'Άλσος Λαϊκής Κυριαρχίας, Álimos',37.9146,23.73357,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Grecotel Club Marine Palace','parc_exterior','Pánormos','Nomós Rethýmnis',NULL,'Grecotel Club Marine Palace, Pánormos',35.41781,24.6863,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Α.Σ. ΣΑΡΙΣΕΣ','parc_exterior','Flórina','Nomós Florínis',NULL,'Καταφύγιο άγριας ζωής "Φλώρινας", Flórina',40.78917,21.41513,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Alimos Volley - ΑΠΣ Αλίμου','parc_exterior','Álimos','Nomarchía Athínas',NULL,'Alimos Volley - ΑΠΣ Αλίμου, Álimos',37.90665,23.72232,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis ΔΗΜΟΤΙΚΟ ΠΑΡΚΟ ΓΕΩΡΓΙΟΣ ΧΑΡ. ΠΑΠΑΔΑΚΗΣ','parc_exterior','Georgioupolis','Nomós Chaniás',NULL,'ΔΗΜΟΤΙΚΟ ΠΑΡΚΟ ΓΕΩΡΓΙΟΣ ΧΑΡ. ΠΑΠΑΔΑΚΗΣ, Georgioupolis',35.36406,24.26103,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Πάρκο Ναυαρίνου','parc_exterior','Ilioúpoli','Nomarchía Athínas',NULL,'Πάρκο Ναυαρίνου, Ilioúpoli',37.93906,23.7515,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Πάρκο Ναυαρίνου (2)','parc_exterior','Ilioúpoli','Nomarchía Athínas',NULL,'Πάρκο Ναυαρίνου, Ilioúpoli',37.93904,23.75152,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Πάρκο Ναυαρίνου (3)','parc_exterior','Ilioúpoli','Nomarchía Athínas',NULL,'Πάρκο Ναυαρίνου, Ilioúpoli',37.93909,23.75149,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Serita Beach','parc_exterior','Limín Khersonísou','Heraklion Regional Unit',NULL,'Serita Beach, Limín Khersonísou',35.33851,25.36445,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Πλατεία Λευκωσίας','parc_exterior','Argyroúpoli','Nomarchía Athínas',NULL,'Πλατεία Λευκωσίας, Argyroúpoli',37.90266,23.74628,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Πάρκο Ασυρμάτου','parc_exterior','Agios Dimitrios','Nomarchía Athínas',NULL,'Πάρκο Ασυρμάτου, Agios Dimitrios',37.93356,23.72238,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Παιδική χαρά Χριστιανουπόλεως ("Κλούβα")','parc_exterior','Galátsi','Nomarchía Athínas',NULL,'Παιδική χαρά Χριστιανουπόλεως ("Κλούβα"), Galátsi',38.02618,23.74556,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Οπακε-Ομε ΟΤΕ','parc_exterior','Témeni','Nomós Achaḯas',NULL,'Οπακε-Ομε ΟΤΕ, Témeni',38.24562,22.13226,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Πλατεία Δημοκρατίας του Περού','parc_exterior','Zográfos','Nomarchía Athínas',NULL,'Πλατεία Δημοκρατίας του Περού, Zográfos',37.9706,23.77646,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Footvolley Athens','parc_exterior','Moskháton','Nomarchía Athínas',NULL,'Footvolley Athens, Moskháton',37.95465,23.67897,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Πολυτεχνείο Κρήτης','parc_exterior','Pithári','Nomós Chaniás',NULL,'Πολυτεχνείο Κρήτης, Pithári',35.52801,24.0673,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Πολυτεχνείο Κρήτης (2)','parc_exterior','Pithári','Nomós Chaniás',NULL,'Πολυτεχνείο Κρήτης, Pithári',35.52803,24.06732,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Sani Rest','parc_exterior','Néa Fókaia','Nomós Chalkidikís',NULL,'Sani Rest, Néa Fókaia',40.10117,23.30937,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Sani Rest (2)','parc_exterior','Néa Fókaia','Nomós Chalkidikís',NULL,'Sani Rest, Néa Fókaia',40.10121,23.30939,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Πάρκο Πολυχρόνη Πολυχρονίδη (Πευκάκια)','parc_exterior','Chaniá','Nomós Chaniás',NULL,'Πάρκο Πολυχρόνη Πολυχρονίδη (Πευκάκια), Chaniá',35.51457,24.0131,1,true,true,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Νέο Πάρκο','parc_exterior','Flórina','Nomós Florínis',NULL,'Νέο Πάρκο, Flórina',40.78233,21.4096,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Νέο Πάρκο (2)','parc_exterior','Flórina','Nomós Florínis',NULL,'Νέο Πάρκο, Flórina',40.7823,21.40953,1,true,false,NULL,NULL,ARRAY['exterior'],true,false),
  ('Table tennis Sandy Beach Hotel','parc_exterior','Pylí','Dodecanese',NULL,'Sandy Beach Hotel, Pylí',36.87473,27.14226,1,true,false,NULL,NULL,ARRAY['exterior'],true,false)
) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)
JOIN cities c ON c.country_code='GR' AND c.name=v.city
ON CONFLICT (name,city_id) DO NOTHING;
COMMIT;
