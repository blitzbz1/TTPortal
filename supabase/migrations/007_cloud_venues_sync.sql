-- Migration: 007_cloud_venues_sync
-- Synced 52 venues from cloud Supabase (deduplicated).
-- Original cloud had 119 total entries.

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Automatica', 'parc_exterior', 'București', 'Ilfov', 'Sector 2', 'Str. Fabrica de Glucoză, Sector 2, București', 44.4735, 26.1165, 2, 'acceptabila', 'Acces liber', 'Parc de cartier în zona Floreasca / Colentina.', ARRAY['gratuit', 'exterior', 'sport'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Bazilescu', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', 'Str. Bazilescu, Sector 1, București', 44.4812, 25.9978, 2, 'acceptabila', 'Acces liber', 'Parc de cartier în zona nord-vest a Bucureștiului.', ARRAY['gratuit', 'exterior'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Tei', 'parc_exterior', 'București', 'Ilfov', 'Sector 2', 'Șos. Ștefan cel Mare / Str. Dobrogeanu Gherea, Sector 2', 44.4612, 26.1338, 3, 'acceptabila', 'Acces liber', 'Parc cu lac în Sectorul 2, popular pentru activități sportive.', ARRAY['gratuit', 'exterior', 'lac'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Ping Poc', 'sala_indoor', 'București', 'Ilfov', 'Sector 4', 'Șos. Berceni nr. 104, bl. turn, et. 3, Sector 4', 44.3942, 26.1025, 5, 'profesionala', 'Zilnic 09:00–23:00', 'Nou deschis 2024. Separeu privat + spațiu comun. Concursuri săptămânale.', ARRAY['plată', 'indoor', 'separeu', 'rezervare online', 'Donic Waldner'], false, true, NULL, true, '25 lei/oră (comun) / 35 lei/oră (separeu)', 'https://pingpoc.ro', true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('CS Otilia Badescu – Sala Polivalentă', 'sala_indoor', 'București', 'Ilfov', 'Sector 4', 'Calea Piscului nr. 10, incinta Sala Polivalentă, Sector 4', 44.3982, 26.1008, NULL, 'profesionala', 'L-V 17:30–22:00, weekend 09:00–15:00', 'Sala campioanei Otilia Badescu, multiplu medaliată european și mondial.', ARRAY['plată', 'indoor', 'antrenori', 'robot', 'Donic'], false, true, NULL, true, '35 lei/oră (robot: 50 lei/oră)', 'https://www.facebook.com/profile.php?id=61563913030853', true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Ioanid', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', 'Str. Orlando / Bd. Dacia, Sector 1, București', 44.4513, 26.0849, 2, 'acceptabila', 'Acces liber', 'Parc mic, elegant, în zona rezidențială Sector 1.', ARRAY['gratuit', 'exterior'], true, false, false, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Drumul Taberei (Moghioroș)', 'parc_exterior', 'București', 'Ilfov', 'Sector 6', 'Bd. Timișoara / Str. Brașov, Sector 6, București', 44.420917, 26.029722, 6, 'buna', 'Acces liber', 'Parc mare din Sectorul 6, facilități sportive multiple.', ARRAY['gratuit', 'exterior'], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Sfânta Cristina', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', 'Strada Siret 95, 012244 București', 44.463694, 26.062222, 1, 'buna', 'Acces liber', NULL, ARRAY['gratuit', 'exterior'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Râul Colentina', 'parc_exterior', 'București', 'Ilfov', 'Sector 2', 'Zona râului Colentina, Sector 2, București', 44.454278, 26.1495, 4, 'buna', 'Acces liber', '4 mese cu fileuri', ARRAY['gratuit', 'exterior', 'mal râu'], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Regina Maria', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', 'Str. Turda 117, 011322 București', 44.457833, 26.0665, 2, 'acceptabila', 'Acces liber', 'Spațiu verde urban cu loc de joacă, fântâni și bănci, plus teren de baschet și două parcuri pentru câini.', ARRAY['gratuit', 'exterior', 'loc joacă'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Florilor', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', '26.1697544.4440280', 44.444028, 26.16975, 3, 'acceptabila', 'Acces liber', 'Pantelimon / Delfinului', ARRAY['gratuit', 'exterior'], true, true, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Ferentari', 'parc_exterior', 'București', 'Ilfov', 'Sector 5', 'Calea Ferentari, Sector 5, București', 44.41127, 26.07502, 2, 'deteriorata', 'Acces liber', 'Parc de cartier Sector 5. Starea dotărilor variabilă.', ARRAY['gratuit', 'exterior', 'deteriorat'], true, false, false, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Ping Pong Academy', 'sala_indoor', 'București', 'Ilfov', 'Sector 5', 'Strada Haţegana 17, 052034 București', 44.407917, 26.093917, 12, 'profesionala', 'Luni–Duminică (verificați pagina)', 'Club complet cu antrenori, echipă Divizia A, concursuri interne.', ARRAY['plată', 'indoor', 'antrenori', 'Divizia A', 'concursuri'], false, true, true, true, '33–43 lei/oră', 'https://www.facebook.com/clubsportivpingpongacademy', true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Liniei', 'parc_exterior', 'București', 'Ilfov', 'Sector 6', 'Str. Lujerului, București', 44.431417, 26.0375, 4, 'buna', 'Acces liber', 'Parc liniar pe fosta linie de tramvai.', ARRAY['gratuit', 'exterior', 'liniar'], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Miniparcul Dumitru Teodoru – Viilor', 'parc_exterior', 'București', 'Ilfov', 'Sector 5', 'Calea Viilor / Str. Dumitru Teodoru, Sector 5', 44.41682, 26.08435, 1, 'necunoscuta', 'Acces liber', 'Minispaciu verde de cartier. Dotări minime – necesită verificare.', ARRAY['gratuit', 'exterior', 'mic'], true, false, false, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('PingPro', 'sala_indoor', 'București', 'Ilfov', 'Sector 1', 'Str. Copilului nr. 20A, Domenii, Sector 1, București', 44.46497, 26.0604, NULL, 'profesionala', 'D-J 08:30–22:30, V-S 08:30–23:30', 'Deschis 2025. Rezervare online cu alegere masă. Sistem reluări instant.', ARRAY['plată', 'indoor', 'rezervare online', 'sistem reluări', 'Joola'], false, true, false, true, 'variabil (promoții disponibile)', 'https://www.pingpro.ro', true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Kiseleff', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', 'Șos. Kiseleff, Sector 1, București', 44.455833, 26.084417, 3, 'acceptabila', 'Acces liber', 'Parc central-nord, parte din axa verde a capitalei.', ARRAY['gratuit', 'exterior'], true, true, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Pridvorului', 'parc_exterior', 'București', 'Ilfov', 'Sector 2', 'Strada Pridvorului, Sector 2, București', 44.462, 26.105, 5, 'buna', 'Acces liber', 'Unele mese la umbra copacilor — plăcut vara. Confirmat pe pingpongmap.net.', ARRAY['gratuit', 'exterior', 'umbră', 'vară'], true, false, true, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('CS Stirom – Tenis de Masă', 'sala_indoor', 'București', 'Ilfov', 'Sector 3', 'Bulevardul Theodor Pallady nr. 45, Sector 3, București', 44.419, 26.168, 5, 'profesionala', 'Zilnic de la ora 09:00 (verificați)', 'Sală dedicată exclusiv tenisului de masă, incinta fabricii Stirom. Club cu tradiție, antrenori cu experiență, foști campioni naționali. Cursuri inițiere, perfecționare și performanță. Tel: 0723.306.531', ARRAY['plată', 'indoor', 'antrenori', 'Sector 3', 'tradiție'], false, false, NULL, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Baza Sportivă Str. Vișagului – S3', 'parc_exterior', 'București', 'Ilfov', 'Sector 3', 'Strada Vișagului, Sector 3, București', 44.428, 26.152, 2, 'buna', 'Acces liber – rezervare gratuită pe sport3.primarie3.ro', 'Bază sportivă multifuncțională Primăria Sector 3. Mese TM, fotbal, baschet. Rezervare online gratuită.', ARRAY['gratuit', 'exterior', 'Sector 3', 'rezervare online', 'multifuncțional'], true, false, true, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Baza Sportivă Bd. Unirii Esplanada – S3', 'parc_exterior', 'București', 'Ilfov', 'Sector 3', 'Bulevardul Unirii, Zona Esplanada, Sector 3, București', 44.426, 26.11, 2, 'buna', 'Acces liber – rezervare gratuită pe sport3.primarie3.ro', 'Bază sportivă Primăria Sector 3. Central, lângă Bd. Unirii. Rezervare online gratuită.', ARRAY['gratuit', 'exterior', 'Sector 3', 'rezervare online', 'central'], true, false, true, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Baza Sportivă Str. Drumeagului – S3', 'parc_exterior', 'București', 'Ilfov', 'Sector 3', 'Strada Drumeagului, Sector 3, București', 44.415, 26.16, 2, 'buna', 'Acces liber – rezervare gratuită pe sport3.primarie3.ro', 'Bază sportivă multifuncțională Primăria Sector 3. Rezervare online gratuită.', ARRAY['gratuit', 'exterior', 'Sector 3', 'rezervare online'], true, false, true, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Tenis Mac Gym', 'sala_indoor', 'București', 'Ilfov', 'Sector 4', 'Calea Văcărești nr. 391, incinta sala Elite Performance, Sun Plaza, Sector 4, București', 44.384, 26.087, 6, 'profesionala', 'L-V 09:00–22:00, S 08:00–22:00, D 08:00–14:00', '6 mese de închiriat + 8 pentru competiții. Echipa CS TTT București Divizia A.', ARRAY['plată', 'indoor', 'antrenori', 'concursuri', 'Andro', 'Divizia A'], false, true, NULL, true, '30 lei/oră (zi) / 35 lei/oră (weekend seara)', 'https://www.tenis-masa.ro', true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Viva Sport Club – Tenis de Masă', 'sala_indoor', 'București', 'Ilfov', 'Sector 4', 'Șos. Oltenitei nr. 103, Sector 4, București', 44.3805, 26.1045, NULL, 'profesionala', 'Verificați site-ul oficial', 'Card de membru obligatoriu (10 lei). ~30 min înregistrare la prima vizită.', ARRAY['plată', 'indoor', 'card membru', 'Piața Sudului'], false, true, NULL, true, '40 lei/oră', 'https://www.vivasportclub.ro', true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Izvor', 'parc_exterior', 'București', 'Ilfov', 'Sector 5', 'Splaiul Independenței, Parcul Izvor, Sector 5, București', 44.432833, 26.088472, 4, 'deteriorata', 'Acces liber', 'Parc central, lângă Palatul Parlamentului.', ARRAY['gratuit', 'exterior', 'central', 'Izvor'], true, false, false, false, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('PingPro Domenii Park', 'sala_indoor', 'București', 'Ilfov', '—', 'Str. Copilului nr. 20A, Sector 1', 44.4647599, 26.061214, NULL, 'profesionala', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], false, true, false, true, 'Dinamic', NULL, true, '2026-03-19T08:52:51.669195+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Ping Pong Miramar', 'sala_indoor', 'București', 'Ilfov', 'Sector 2', 'Bulevardul Chișinău 6, 022152 București', 44.441139, 26.156472, 5, 'profesionala', 'Verificați pagina Facebook', '5 mese omologate ITTF, blat 25mm. Atmosferă relaxată cu muzică și bar.', ARRAY['plată', 'indoor', 'ITTF', 'muzică', 'bar'], false, true, false, true, 'verificați pagina Facebook', 'https://www.facebook.com/PingPongSector2/', true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('TSP Vibe', 'sala_indoor', 'București', 'Ilfov', 'Sector 3', 'Șos. Dudești-Pantelimon nr. 44, incinta Antilopa, Sector 3', 44.4386302876457, 26.1943227239488, 9, 'profesionala', 'Verificați pagina Facebook', '540 mp, PVC. Concursuri luni/marți/miercuri de la 18:30. Robot disponibil.', ARRAY['plată', 'indoor', 'robot', 'concursuri', '540mp'], false, true, true, true, '25 lei/oră (L-V 10–16) / 35 lei/oră (vârf)', 'https://www.facebook.com/groups/3146582045558341/', true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('IDM Club – Tenis de Masă', 'sala_indoor', 'București', 'Ilfov', 'Sector 6', 'Splaiul Independenței nr. 319B, Sector 6, București', 44.443972, 26.048833, 10, 'profesionala', 'L-J 09:00–01:00, V-S 09:00–03:00, D 09:00–01:00', NULL, ARRAY['plată', 'indoor', 'bowling', 'biliard', 'piscină', 'fitness', 'Butterfly'], false, true, true, true, 'verificați site-ul (card 150 lei/an)', 'https://www.idmclub.ro', true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('eWe Ping Pong', 'sala_indoor', 'București', 'Ilfov', 'Ilfov', 'Str. Fortului nr. 81, Domnești, Ilfov (incinta eWe Market)', 44.361, 25.992, 7, 'profesionala', 'Zilnic 09:00–22:00', 'Deschis ianuarie 2024. Recomandat pentru Militari/Ghencea/Rahova. Cafenea inclusă.', ARRAY['plată', 'indoor', 'Ilfov', 'cafenea', 'Joola 25', 'ITTF'], false, true, NULL, true, '35 lei/oră (fix)', 'https://ewepingpong.ro', true, '2026-03-19T08:31:09.257296+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Kiris Hall', 'sala_indoor', 'București', 'Ilfov', 'Sector 2', 'Șos. Pantelimon 1-3, 021591 București', 44.4481742, 26.1333387, 8, 'profesionala', '09:00-00:00', 'Adăugat de comunitate.', ARRAY['nou adăugat'], false, true, false, true, '20 lei pe ora de luni pana vineri, 09:00-14:00, 40 lei ora in weekend si de luni pana vineri dupa ora 14', NULL, true, '2026-03-19T10:43:11.601905+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Cosmos', 'parc_exterior', 'București', 'Ilfov', 'Sector 3', 'Parcul Cosmos, Șos. Pantelimon 367, București', 44.441111, 26.184972, 2, 'buna', '7-22', 'Adăugat de comunitate.', ARRAY['nou adăugat'], true, false, true, false, NULL, NULL, true, '2026-03-20T06:48:15.854584+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Drumul Taberei 2 (Moghioroș)', 'parc_exterior', 'București', 'Ilfov', '6', '44.421667	26.030750', 44.4216990634355, 26.030747294426, 3, 'buna', '7-22', 'Adăugat de comunitate.', ARRAY['nou adăugat'], true, false, false, false, NULL, NULL, true, '2026-03-20T06:58:05.077063+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Cetatea Histria', 'parc_exterior', 'București', 'Ilfov', NULL, 'Strada Cetatea Histria,nr. 16-20, București', 44.4200457, 26.0227148, 2, 'necunoscuta', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], true, false, true, false, NULL, NULL, true, '2026-03-21T07:04:29.585658+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Timisoara', 'parc_exterior', 'București', 'Ilfov', '6', 'Bulevardul Timișoara 10, 061344 București', 44.4286713, 26.0441141, 4, 'necunoscuta', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], true, false, NULL, false, NULL, NULL, true, '2026-03-21T07:13:41.640781+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul “C5”', 'parc_exterior', 'București', 'Ilfov', NULL, 'Aleea Bistra 1, 061344 București', 44.42624, 26.0488, 1, 'necunoscuta', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], true, false, false, false, NULL, NULL, true, '2026-03-21T07:16:20.691683+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Sală de tenis de masă Set 11', 'sala_indoor', 'Sibiu', 'Sibiu', NULL, 'Strada August Treboniu Laurian, 2-4', 45.8016044, 24.1668087, NULL, 'profesionala', NULL, NULL, ARRAY['osm', 'way/95993443'], false, false, NULL, false, '35 RON', 'https://www.b-52.ro/', true, '2026-03-21T09:10:23.997809+00:00')
;

-- Removed 4 venues with NULL city/address (Sală tenis de masă, CS Top Team Tulcea, Table tennis Ioanid park, Ping Pong Table)

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Masă tenis de masă', 'parc_exterior', 'Agăș', 'Bacău', NULL, 'Strada Principală, 116', 46.4846352, 26.2203157, NULL, 'necunoscuta', NULL, NULL, ARRAY['osm', 'acoperit', 'way/1308638798'], true, false, NULL, false, NULL, NULL, true, '2026-03-21T09:10:23.997809+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('CS Otilia Bădescu', 'sala_indoor', 'București', 'Ilfov', NULL, 'Calea Piscului, 10', 44.4053795, 26.1109869, NULL, 'profesionala', 'Mo-Fr 17:30-22:00; Sa-Su 09:00-15:00', 'Sala jucătoarei campioane Otilia Bădescu, mese Donic albastre profesionale. Incinta Sălii Polivalente lângă Parcul Tineretului.', ARRAY['osm', 'custom/5'], false, false, NULL, false, '35 RON/oră', NULL, true, '2026-03-21T09:10:23.997809+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('PingPoc', 'sala_indoor', 'București', 'Ilfov', NULL, 'Șoseaua Berceni, 104', 44.3679305, 26.1428287, 5, 'profesionala', 'Mo-Su 09:00-23:00', '5 mese Donic Waldner profesionale (2 în separeu privat), deschis 2024. Față de metrou Dimitrie Leonida. Bloc Turn, Et. 3.', ARRAY['osm', 'custom/8'], false, false, NULL, false, '25-35 RON/oră', 'https://www.facebook.com/pingpoc.ro', true, '2026-03-21T09:10:23.997809+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Kiris Hall – Tenis de Masă', 'sala_indoor', 'București', 'Ilfov', NULL, 'Șos. Pantelimon, 1-3', 44.4487461, 26.1346999, NULL, 'profesionala', 'Mo-Fr 09:00-23:00; Sa-Su 09:00-23:30', 'Academie gimnastică și tenis de masă (Academia Larisa Iordache). Mese profesionale, antrenori certificați. Rezervare online disponibilă.', ARRAY['osm', 'custom/9'], false, false, NULL, false, NULL, 'https://kiris-hall.ro/', true, '2026-03-21T09:10:23.997809+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Rocket Spin', 'sala_indoor', 'Timișoara', 'Timiș', NULL, 'Calea Aradului, 48A', 45.777013, 21.2213122, NULL, 'profesionala', 'Mo-Su 10:00-22:00', 'Cea mai profesională sală din Timișoara. Mese Butterfly Octet 25 (ITTF), 3 camere VIP, robot Butterfly, antrenori. Rezervare prealabilă.', ARRAY['osm', 'custom/10'], false, false, NULL, false, NULL, 'https://www.rocketspintenisdemasa.com/', true, '2026-03-21T09:10:23.997809+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Baza Sportivă Gheorgheni – Tenis de Masă', 'sala_indoor', 'Cluj-Napoca', 'Cluj', NULL, 'Strada Marechal Constantin Prezan', 46.7700626, 23.6360361, 8, 'profesionala', 'Mo-Fr 09:00-22:00; Sa-Su 10:00-22:00', '8 mese tenis de masă gratuite, rezervare prealabilă online necesară, echipament propriu. Complex sportiv public al Primăriei Cluj-Napoca.', ARRAY['osm', 'custom/11'], true, false, NULL, false, NULL, 'https://sportinclujnapoca.ro/', true, '2026-03-21T09:10:23.997809+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Baza Sportivă «La Terenuri» – Tenis de Masă', 'sala_indoor', 'Cluj-Napoca', 'Cluj', NULL, 'Strada Pârâng, FN', 46.7489241, 23.55459, 8, 'profesionala', 'Mo-Fr 09:00-22:00; Sa-Su 10:00-22:00', '8 mese tenis de masă, rezervare online, echipament propriu (palete + mingi). Bază publică, acces gratuit. Cartier Mănăștur.', ARRAY['osm', 'custom/12'], true, false, NULL, false, NULL, 'https://manastur.sportinclujnapoca.ro/', true, '2026-03-21T09:10:23.997809+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('ARENA Brasov – Tenis de Masă', 'sala_indoor', 'Săcele', 'Brașov', NULL, 'Strada Gospodarilor, 2', 45.616955, 25.6675707, 8, 'profesionala', 'Mo-Th 13:00-22:00; Fr 13:00-17:00', '8 mese Joola 2000-S (ITTF), podea Taraflex, iluminat LED profesional, vestiare cu dușuri, parcare privată. Centura ocolitoare Săcele.', ARRAY['osm', 'custom/13'], false, false, NULL, false, NULL, 'https://arena-brasov.ro/', true, '2026-03-21T09:10:23.997809+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('ACS TT Energy Brașov', 'sala_indoor', 'Brașov', 'Brașov', NULL, 'Strada Zizinului, 106', 45.6473296, 25.6417153, NULL, 'profesionala', 'Mo-Fr 15:00-21:00', 'Club de tenis de masă, cursuri inițiere și perfecționare copii, Liceul Energetic Brașov.', ARRAY['osm', 'custom/14'], false, false, NULL, false, NULL, NULL, true, '2026-03-21T09:10:23.997809+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Top Spin – Tenis de Masă Craiova', 'sala_indoor', 'Craiova', 'Dolj', NULL, 'Strada Grigore Gabrielescu, 1A', 44.3334005, 23.7788649, 3, 'profesionala', 'Mo-Su 10:00-21:00', '3 mese Andro Competition profesionale, podea Taraflex sportivă. Antrenamente și inchiriere.', ARRAY['osm', 'custom/15'], false, false, NULL, false, NULL, 'https://topspincraiova.com/', true, '2026-03-21T09:10:23.997809+00:00')
;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Complexul Sportiv Flux Arena – Tenis de Masă', 'sala_indoor', 'Cârcă', 'Dolj', NULL, 'Strada Complexului, 6A', 44.2986365, 23.8999204, NULL, 'profesionala', 'Mo-Su 08:00-03:00', 'Complex sportiv cu mese de tenis de masă, terenuri tenis, fotbal. Rezervare telefonică. Sat Cârcă, lângă Craiova.', ARRAY['osm', 'custom/16'], false, false, NULL, false, NULL, 'https://www.fluxarena.net/', true, '2026-03-21T09:10:23.997809+00:00')
;

-- Update city venue counts
UPDATE public.cities SET venue_count = (
  SELECT COUNT(*) FROM public.venues WHERE venues.city = cities.name AND venues.approved = true
);
