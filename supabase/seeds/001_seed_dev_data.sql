-- Migration: 007_seed_dev_data
-- Development seed data: auth users, profiles, friendships, reviews, favorites,
-- checkins, condition_votes, events, event_participants, notifications.
-- Uses deterministic UUIDs so the data is reproducible and relationships are consistent.

-- ============================================================
-- 1. AUTH USERS (10 demo users + 1 E2E test user)
-- Password for all: test1234
-- The on_auth_user_created trigger auto-creates profiles.
-- ============================================================
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at, is_sso_user, is_anonymous,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token,
  reauthentication_token
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'andrei@test.com', crypt('test1234', gen_salt('bf')),
   '2025-11-01T10:00:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Andrei Popescu","email_verified":true}',
   false, '2025-11-01T10:00:00Z', '2025-11-01T10:00:00Z', false, false,
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'maria@test.com', crypt('test1234', gen_salt('bf')),
   '2025-11-05T14:30:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Maria Ionescu","email_verified":true}',
   false, '2025-11-05T14:30:00Z', '2025-11-05T14:30:00Z', false, false,
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'cristian@test.com', crypt('test1234', gen_salt('bf')),
   '2025-11-10T09:15:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Cristian Dumitrescu","email_verified":true}',
   false, '2025-11-10T09:15:00Z', '2025-11-10T09:15:00Z', false, false,
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'elena@test.com', crypt('test1234', gen_salt('bf')),
   '2025-11-15T16:00:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Elena Vasilescu","email_verified":true}',
   false, '2025-11-15T16:00:00Z', '2025-11-15T16:00:00Z', false, false,
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'mihai@test.com', crypt('test1234', gen_salt('bf')),
   '2025-11-20T11:45:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Mihai Radu","email_verified":true}',
   false, '2025-11-20T11:45:00Z', '2025-11-20T11:45:00Z', false, false,
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
   'ana@test.com', crypt('test1234', gen_salt('bf')),
   '2025-12-01T08:00:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Ana Georgescu","email_verified":true}',
   false, '2025-12-01T08:00:00Z', '2025-12-01T08:00:00Z', false, false,
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated',
   'vlad@test.com', crypt('test1234', gen_salt('bf')),
   '2025-12-05T13:20:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Vlad Constantinescu","email_verified":true}',
   false, '2025-12-05T13:20:00Z', '2025-12-05T13:20:00Z', false, false,
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated',
   'ioana@test.com', crypt('test1234', gen_salt('bf')),
   '2025-12-10T17:30:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Ioana Marin","email_verified":true}',
   false, '2025-12-10T17:30:00Z', '2025-12-10T17:30:00Z', false, false,
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated',
   'alex@test.com', crypt('test1234', gen_salt('bf')),
   '2025-12-15T10:00:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Alexandru Stan","email_verified":true}',
   false, '2025-12-15T10:00:00Z', '2025-12-15T10:00:00Z', false, false,
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated',
   'diana@test.com', crypt('test1234', gen_salt('bf')),
   '2025-12-20T15:00:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Diana Preda","email_verified":true}',
   false, '2025-12-20T15:00:00Z', '2025-12-20T15:00:00Z', false, false,
   '', '', '', '', '', '', '', ''),

  -- E2E signup test user (must pre-exist so signup returns "already registered" error)
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated',
   'e2e-test@ttportal.ro', crypt('test1234', gen_salt('bf')),
   '2025-10-01T10:00:00Z', '{"provider":"email","providers":["email"]}',
   '{"full_name":"Test User E2E","email_verified":true}',
   false, '2025-10-01T10:00:00Z', '2025-10-01T10:00:00Z', false, false,
   '', '', '', '', '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. AUTH IDENTITIES (required for email/password login)
-- ============================================================
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   '{"sub":"a1000000-0000-0000-0000-000000000001","email":"andrei@test.com","email_verified":true}',
   'email', '2025-11-01T10:00:00Z', '2025-11-01T10:00:00Z'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
   '{"sub":"a1000000-0000-0000-0000-000000000002","email":"maria@test.com","email_verified":true}',
   'email', '2025-11-05T14:30:00Z', '2025-11-05T14:30:00Z'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
   '{"sub":"a1000000-0000-0000-0000-000000000003","email":"cristian@test.com","email_verified":true}',
   'email', '2025-11-10T09:15:00Z', '2025-11-10T09:15:00Z'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004',
   '{"sub":"a1000000-0000-0000-0000-000000000004","email":"elena@test.com","email_verified":true}',
   'email', '2025-11-15T16:00:00Z', '2025-11-15T16:00:00Z'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005',
   '{"sub":"a1000000-0000-0000-0000-000000000005","email":"mihai@test.com","email_verified":true}',
   'email', '2025-11-20T11:45:00Z', '2025-11-20T11:45:00Z'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006',
   '{"sub":"a1000000-0000-0000-0000-000000000006","email":"ana@test.com","email_verified":true}',
   'email', '2025-12-01T08:00:00Z', '2025-12-01T08:00:00Z'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000007',
   '{"sub":"a1000000-0000-0000-0000-000000000007","email":"vlad@test.com","email_verified":true}',
   'email', '2025-12-05T13:20:00Z', '2025-12-05T13:20:00Z'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000008',
   '{"sub":"a1000000-0000-0000-0000-000000000008","email":"ioana@test.com","email_verified":true}',
   'email', '2025-12-10T17:30:00Z', '2025-12-10T17:30:00Z'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000009',
   '{"sub":"a1000000-0000-0000-0000-000000000009","email":"alex@test.com","email_verified":true}',
   'email', '2025-12-15T10:00:00Z', '2025-12-15T10:00:00Z'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000010',
   '{"sub":"a1000000-0000-0000-0000-000000000010","email":"diana@test.com","email_verified":true}',
   'email', '2025-12-20T15:00:00Z', '2025-12-20T15:00:00Z'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000011',
   '{"sub":"a1000000-0000-0000-0000-000000000011","email":"e2e-test@ttportal.ro","email_verified":true}',
   'email', '2025-10-01T10:00:00Z', '2025-10-01T10:00:00Z')
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ============================================================
-- 3. UPDATE PROFILES (add city, username, admin flag, etc.)
--    The trigger created minimal profiles; enrich them here.
-- ============================================================
UPDATE public.profiles SET city = 'București', lang = 'ro', username = 'andrei_p',   is_admin = true  WHERE id = 'a1000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET city = 'București', lang = 'ro', username = 'maria_i',    is_admin = false WHERE id = 'a1000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET city = 'București', lang = 'ro', username = 'cristi_d',   is_admin = false WHERE id = 'a1000000-0000-0000-0000-000000000003';
UPDATE public.profiles SET city = 'Cluj-Napoca',lang = 'ro', username = 'elena_v',   is_admin = false WHERE id = 'a1000000-0000-0000-0000-000000000004';
UPDATE public.profiles SET city = 'București', lang = 'ro', username = 'mihai_r',    is_admin = false WHERE id = 'a1000000-0000-0000-0000-000000000005';
UPDATE public.profiles SET city = 'Timișoara', lang = 'ro', username = 'ana_g',      is_admin = false WHERE id = 'a1000000-0000-0000-0000-000000000006';
UPDATE public.profiles SET city = 'București', lang = 'en', username = 'vlad_c',     is_admin = false WHERE id = 'a1000000-0000-0000-0000-000000000007';
UPDATE public.profiles SET city = 'Iași',      lang = 'ro', username = 'ioana_m',    is_admin = false WHERE id = 'a1000000-0000-0000-0000-000000000008';
UPDATE public.profiles SET city = 'Brașov',   lang = 'ro', username = 'alex_s',     is_admin = false WHERE id = 'a1000000-0000-0000-0000-000000000009';
UPDATE public.profiles SET city = 'București', lang = 'ro', username = 'diana_p',    is_admin = false WHERE id = 'a1000000-0000-0000-0000-000000000010';

-- ============================================================
-- 4. ADDITIONAL VENUES (more cities)
-- ============================================================
INSERT INTO public.venues (name, type, city, county, address, lat, lng, tables_count, condition, free_access, night_lighting, nets, verified, approved, submitted_by, created_at) VALUES
  ('Parcul Central',        'parc_exterior', 'Cluj-Napoca', 'Cluj',    'Str. Napoca nr. 1',          46.7700, 23.5900, 3, 'buna',        true,  false, true,  true,  true, 'a1000000-0000-0000-0000-000000000004', '2025-12-01T09:00:00Z'),
  ('Sala Polivalentă BT Arena','sala_indoor','Cluj-Napoca', 'Cluj',    'Aleea Stadionului nr. 2',    46.7650, 23.5700, 10,'profesionala', false, true,  true,  true,  true, 'a1000000-0000-0000-0000-000000000004', '2025-12-02T10:00:00Z'),
  ('Parcul Rozelor',        'parc_exterior', 'Timișoara',   'Timiș',   'Str. Gheorghe Dima',         45.7550, 21.2300, 2, 'acceptabila', true,  false, false, false, true, 'a1000000-0000-0000-0000-000000000006', '2025-12-05T11:00:00Z'),
  ('Parcul Copou',          'parc_exterior', 'Iași',        'Iași',     'Bd. Carol I',                47.1740, 27.5720, 4, 'buna',        true,  true,  true,  true,  true, 'a1000000-0000-0000-0000-000000000008', '2025-12-10T14:00:00Z'),
  ('Sala Olimpia',          'sala_indoor',   'Brașov',     'Brașov',  'Str. Olimpiadei nr. 3',      45.6500, 25.6100, 6, 'profesionala', false, true,  true,  true,  true, 'a1000000-0000-0000-0000-000000000009', '2025-12-15T09:30:00Z'),
  ('Parcul Tineretului',    'parc_exterior', 'București',   'București','Bd. Tineretului',            44.4050, 26.1030, 5, 'buna',        true,  true,  true,  false, true, 'a1000000-0000-0000-0000-000000000001', '2026-01-05T10:00:00Z'),
  ('Arena Sportivă Drumul Taberei','sala_indoor','București','București','Str. Brasov nr. 25',        44.4220, 26.0410, 12,'profesionala', false, true,  true,  true,  true, 'a1000000-0000-0000-0000-000000000003', '2026-01-10T12:00:00Z'),
  ('Parcul Carol',          'parc_exterior', 'București',   'București','Bd. Mărășești',              44.4130, 26.0980, 3, 'deteriorata', true,  false, false, false, true, 'a1000000-0000-0000-0000-000000000005', '2026-01-15T08:00:00Z')
ON CONFLICT DO NOTHING;

-- Update city venue counts
UPDATE public.cities SET venue_count = (
  SELECT COUNT(*) FROM public.venues WHERE venues.city = cities.name AND venues.approved = true
);

-- ============================================================
-- 5. FRIENDSHIPS (various statuses)
-- ============================================================
INSERT INTO public.friendships (requester_id, addressee_id, status, created_at) VALUES
  -- Andrei's friend network
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'accepted',  '2025-11-10T12:00:00Z'),
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'accepted',  '2025-11-12T14:00:00Z'),
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000005', 'accepted',  '2025-11-25T09:00:00Z'),
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000007', 'accepted',  '2025-12-08T11:00:00Z'),
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000010','pending',   '2026-03-20T10:00:00Z'),
  -- Maria's connections
  ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 'accepted',  '2025-11-15T10:00:00Z'),
  ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000005', 'accepted',  '2025-12-01T16:00:00Z'),
  ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000010','accepted',  '2026-01-05T08:00:00Z'),
  -- Cross-city friendships
  ('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', 'accepted',  '2025-12-10T13:00:00Z'),
  ('a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000006', 'accepted',  '2025-12-20T15:00:00Z'),
  ('a1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000008', 'pending',   '2026-02-15T10:00:00Z'),
  ('a1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 'accepted',  '2026-01-10T12:00:00Z'),
  ('a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000006', 'declined',  '2026-01-20T09:00:00Z'),
  ('a1000000-0000-0000-0000-000000000010','a1000000-0000-0000-0000-000000000007', 'accepted',  '2026-02-01T11:00:00Z')
ON CONFLICT (requester_id, addressee_id) DO NOTHING;

-- ============================================================
-- 6. REVIEWS (spread across venues)
-- ============================================================
INSERT INTO public.reviews (venue_id, user_id, reviewer_name, rating, body, created_at) VALUES
  -- Parcul Național (venue 1)
  (1, 'a1000000-0000-0000-0000-000000000001', 'Andrei Popescu',  5, 'Mese excelente, bine întreținute. Locul meu preferat din București!', '2025-12-01T10:00:00Z'),
  (1, 'a1000000-0000-0000-0000-000000000002', 'Maria Ionescu',   4, 'Foarte ok, doar că uneori e aglomerat în weekend.',                 '2025-12-15T14:00:00Z'),
  (1, 'a1000000-0000-0000-0000-000000000005', 'Mihai Radu',      4, 'Mese bune, fileuri ok. Recomandat!',                                '2026-01-10T11:00:00Z'),
  -- Sala Sporturilor Titan (venue 2)
  (2, 'a1000000-0000-0000-0000-000000000003', 'Cristian Dumitrescu',5,'Cea mai bună sală din zona Titan. Mese profesionale Butterfly.',   '2025-12-10T09:00:00Z'),
  (2, 'a1000000-0000-0000-0000-000000000007', 'Vlad Constantinescu',4,'Great facilities, a bit pricey but worth it.',                    '2026-01-05T13:00:00Z'),
  (2, 'a1000000-0000-0000-0000-000000000010','Diana Preda',       5, 'Sală de top! Antrenament profesional aici.',                        '2026-02-01T16:00:00Z'),
  -- Parcul IOR (venue 3)
  (3, 'a1000000-0000-0000-0000-000000000001', 'Andrei Popescu',  3, 'Mesele sunt cam uzate, dar e gratis și accesibil.',                 '2025-12-20T10:00:00Z'),
  (3, 'a1000000-0000-0000-0000-000000000005', 'Mihai Radu',      2, 'Mesele au nevoie de reparații urgente. Fileuri lipsă.',              '2026-01-15T09:00:00Z'),
  -- Parcul Herăstrău (venue 4)
  (4, 'a1000000-0000-0000-0000-000000000002', 'Maria Ionescu',   5, 'Cel mai frumos cadru natural pentru ping pong!',                    '2025-12-05T15:00:00Z'),
  (4, 'a1000000-0000-0000-0000-000000000003', 'Cristian Dumitrescu',4,'Mese bine întreținute, iluminat seara. Super!',                   '2026-01-20T11:00:00Z'),
  (4, 'a1000000-0000-0000-0000-000000000010','Diana Preda',       5, 'Loc superb, merită vizitat. Atmosferă plăcută.',                    '2026-02-10T14:00:00Z'),
  (4, 'a1000000-0000-0000-0000-000000000007', 'Vlad Constantinescu',4,'Nice spot near the lake. Good tables.',                           '2026-02-20T10:00:00Z'),
  -- Club Sportiv Dinamo (venue 5)
  (5, 'a1000000-0000-0000-0000-000000000001', 'Andrei Popescu',  5, 'Nivel profesional, mese Stiga competiție. Recomand cu căldură!',    '2026-01-05T10:00:00Z'),
  (5, 'a1000000-0000-0000-0000-000000000003', 'Cristian Dumitrescu',5,'Aici se antrenează campionii. Atmosferă incredibilă.',            '2026-01-25T09:00:00Z'),
  (5, 'a1000000-0000-0000-0000-000000000005', 'Mihai Radu',      4, 'Sală foarte bună, prețuri rezonabile pentru ce oferă.',             '2026-02-05T13:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. FAVORITES
-- ============================================================
INSERT INTO public.favorites (user_id, venue_id, created_at) VALUES
  ('a1000000-0000-0000-0000-000000000001', 1, '2025-12-01T10:30:00Z'),
  ('a1000000-0000-0000-0000-000000000001', 4, '2025-12-05T16:00:00Z'),
  ('a1000000-0000-0000-0000-000000000001', 5, '2026-01-05T10:30:00Z'),
  ('a1000000-0000-0000-0000-000000000002', 4, '2025-12-05T15:30:00Z'),
  ('a1000000-0000-0000-0000-000000000002', 1, '2025-12-15T14:30:00Z'),
  ('a1000000-0000-0000-0000-000000000002', 2, '2026-01-10T09:00:00Z'),
  ('a1000000-0000-0000-0000-000000000003', 2, '2025-12-10T09:30:00Z'),
  ('a1000000-0000-0000-0000-000000000003', 5, '2026-01-25T09:30:00Z'),
  ('a1000000-0000-0000-0000-000000000005', 1, '2026-01-10T11:30:00Z'),
  ('a1000000-0000-0000-0000-000000000005', 5, '2026-02-05T13:30:00Z'),
  ('a1000000-0000-0000-0000-000000000007', 2, '2026-01-05T13:30:00Z'),
  ('a1000000-0000-0000-0000-000000000007', 4, '2026-02-20T10:30:00Z'),
  ('a1000000-0000-0000-0000-000000000010', 2, '2026-02-01T16:30:00Z'),
  ('a1000000-0000-0000-0000-000000000010', 4, '2026-02-10T14:30:00Z'),
  ('a1000000-0000-0000-0000-000000000010', 5, '2026-02-15T11:00:00Z'),
  ('a1000000-0000-0000-0000-000000000004', 6, '2026-01-05T12:00:00Z'),
  ('a1000000-0000-0000-0000-000000000006', 8, '2026-01-10T10:00:00Z'),
  ('a1000000-0000-0000-0000-000000000009', 10,'2026-01-20T15:00:00Z')
ON CONFLICT (user_id, venue_id) DO NOTHING;

-- ============================================================
-- 8. CHECKINS (mix of completed and active sessions)
-- ============================================================
INSERT INTO public.checkins (user_id, venue_id, table_number, started_at, ended_at, friends) VALUES
  -- Past sessions
  ('a1000000-0000-0000-0000-000000000001', 1, 2, '2025-12-01T10:00:00Z', '2025-12-01T11:30:00Z', ARRAY['a1000000-0000-0000-0000-000000000002']::UUID[]),
  ('a1000000-0000-0000-0000-000000000002', 1, 2, '2025-12-01T10:00:00Z', '2025-12-01T11:30:00Z', ARRAY['a1000000-0000-0000-0000-000000000001']::UUID[]),
  ('a1000000-0000-0000-0000-000000000003', 2, 5, '2025-12-10T09:00:00Z', '2025-12-10T11:00:00Z', '{}'::UUID[]),
  ('a1000000-0000-0000-0000-000000000001', 5, 1, '2026-01-05T09:00:00Z', '2026-01-05T11:00:00Z', ARRAY['a1000000-0000-0000-0000-000000000003']::UUID[]),
  ('a1000000-0000-0000-0000-000000000003', 5, 1, '2026-01-05T09:00:00Z', '2026-01-05T11:00:00Z', ARRAY['a1000000-0000-0000-0000-000000000001']::UUID[]),
  ('a1000000-0000-0000-0000-000000000005', 1, 3, '2026-01-10T11:00:00Z', '2026-01-10T12:30:00Z', '{}'::UUID[]),
  ('a1000000-0000-0000-0000-000000000002', 4, 1, '2026-01-15T14:00:00Z', '2026-01-15T15:30:00Z', ARRAY['a1000000-0000-0000-0000-000000000010']::UUID[]),
  ('a1000000-0000-0000-0000-000000000010', 4, 1, '2026-01-15T14:00:00Z', '2026-01-15T15:30:00Z', ARRAY['a1000000-0000-0000-0000-000000000002']::UUID[]),
  ('a1000000-0000-0000-0000-000000000007', 2, 3, '2026-02-01T13:00:00Z', '2026-02-01T14:30:00Z', '{}'::UUID[]),
  ('a1000000-0000-0000-0000-000000000001', 4, 4, '2026-02-10T16:00:00Z', '2026-02-10T17:30:00Z', ARRAY['a1000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000007']::UUID[]),
  ('a1000000-0000-0000-0000-000000000004', 6, 2, '2026-02-15T10:00:00Z', '2026-02-15T11:30:00Z', '{}'::UUID[]),
  ('a1000000-0000-0000-0000-000000000009', 10,1, '2026-02-20T09:00:00Z', '2026-02-20T10:30:00Z', '{}'::UUID[]),
  ('a1000000-0000-0000-0000-000000000001', 2, 7, '2026-03-01T09:00:00Z', '2026-03-01T10:45:00Z', ARRAY['a1000000-0000-0000-0000-000000000003']::UUID[]),
  ('a1000000-0000-0000-0000-000000000003', 2, 7, '2026-03-01T09:00:00Z', '2026-03-01T10:45:00Z', ARRAY['a1000000-0000-0000-0000-000000000001']::UUID[]),
  ('a1000000-0000-0000-0000-000000000005', 3, 1, '2026-03-05T14:00:00Z', '2026-03-05T15:00:00Z', '{}'::UUID[]),
  ('a1000000-0000-0000-0000-000000000010', 5, 2, '2026-03-10T10:00:00Z', '2026-03-10T11:30:00Z', '{}'::UUID[])
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. CONDITION VOTES
-- ============================================================
INSERT INTO public.condition_votes (user_id, venue_id, condition, created_at) VALUES
  ('a1000000-0000-0000-0000-000000000001', 1, 'buna',        '2025-12-01T10:15:00Z'),
  ('a1000000-0000-0000-0000-000000000002', 1, 'buna',        '2025-12-15T14:15:00Z'),
  ('a1000000-0000-0000-0000-000000000005', 1, 'buna',        '2026-01-10T11:15:00Z'),
  ('a1000000-0000-0000-0000-000000000003', 2, 'buna',        '2025-12-10T09:15:00Z'),
  ('a1000000-0000-0000-0000-000000000007', 2, 'buna',        '2026-01-05T13:15:00Z'),
  ('a1000000-0000-0000-0000-000000000001', 3, 'acceptabila', '2025-12-20T10:15:00Z'),
  ('a1000000-0000-0000-0000-000000000005', 3, 'deteriorata', '2026-01-15T09:15:00Z'),
  ('a1000000-0000-0000-0000-000000000002', 4, 'buna',        '2025-12-05T15:15:00Z'),
  ('a1000000-0000-0000-0000-000000000003', 4, 'buna',        '2026-01-20T11:15:00Z'),
  ('a1000000-0000-0000-0000-000000000010', 4, 'buna',        '2026-02-10T14:15:00Z'),
  ('a1000000-0000-0000-0000-000000000001', 5, 'buna',        '2026-01-05T10:15:00Z'),
  ('a1000000-0000-0000-0000-000000000003', 5, 'buna',        '2026-01-25T09:15:00Z'),
  ('a1000000-0000-0000-0000-000000000006', 8, 'acceptabila', '2026-01-10T10:15:00Z'),
  ('a1000000-0000-0000-0000-000000000009', 10,'buna',        '2026-01-20T15:15:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. EVENTS (upcoming, past, various statuses)
-- ============================================================
INSERT INTO public.events (title, description, venue_id, table_number, organizer_id, starts_at, ends_at, max_participants, status, event_type, created_at) VALUES
  -- Past completed events
  ('Turneu Amical Herăstrău',
   'Turneu prietenesc 1v1, format round-robin. Oricine e binevenit!',
   4, 3, 'a1000000-0000-0000-0000-000000000001',
   '2026-02-15T10:00:00Z', '2026-02-15T14:00:00Z',
   8, 'completed', 'tournament', '2026-02-01T10:00:00Z'),

  ('Sesiune Casual Parcul Național',
   'Sesiune relaxată de ping pong duminică dimineața.',
   1, 1, 'a1000000-0000-0000-0000-000000000002',
   '2026-03-02T09:00:00Z', '2026-03-02T11:00:00Z',
   4, 'completed', 'casual', '2026-02-25T12:00:00Z'),

  ('Antrenament Dinamo',
   'Sesiune de antrenament pentru jucători intermediari.',
   5, 4, 'a1000000-0000-0000-0000-000000000003',
   '2026-03-15T18:00:00Z', '2026-03-15T20:00:00Z',
   6, 'completed', 'casual', '2026-03-10T09:00:00Z'),

  -- Upcoming open events
  ('Weekend Challenge Herăstrău',
   'Provocare de weekend! Vino să jucăm și să ne distrăm.',
   4, 1, 'a1000000-0000-0000-0000-000000000001',
   '2026-04-05T10:00:00Z', '2026-04-05T13:00:00Z',
   6, 'open', 'casual', '2026-03-25T10:00:00Z'),

  ('Cupa Primăverii - Titan',
   'Turneu de primăvară la Sala Titan. Premii simbolice!',
   2, NULL, 'a1000000-0000-0000-0000-000000000003',
   '2026-04-12T09:00:00Z', '2026-04-12T17:00:00Z',
   16, 'open', 'tournament', '2026-03-20T08:00:00Z'),

  ('Ping Pong After Work',
   'Sesiune relaxată după program. Aduceți paletele!',
   11, 2, 'a1000000-0000-0000-0000-000000000005',
   '2026-04-03T18:00:00Z', '2026-04-03T20:00:00Z',
   4, 'open', 'casual', '2026-03-26T12:00:00Z'),

  -- Confirmed event
  ('Dublu Mixt Parcul Tineretului',
   'Turneu de dublu mixt, echipe de 2. Înscrieri până pe 10 aprilie.',
   11, NULL, 'a1000000-0000-0000-0000-000000000010',
   '2026-04-15T10:00:00Z', '2026-04-15T15:00:00Z',
   12, 'confirmed', 'tournament', '2026-03-22T14:00:00Z'),

  -- Cancelled event
  ('Sesiune Seară IOR',
   'Anulat din cauza lipsei iluminării.',
   3, 1, 'a1000000-0000-0000-0000-000000000005',
   '2026-03-20T19:00:00Z', '2026-03-20T21:00:00Z',
   4, 'cancelled', 'casual', '2026-03-15T10:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 11. EVENT PARTICIPANTS
-- ============================================================
INSERT INTO public.event_participants (event_id, user_id, joined_at) VALUES
  -- Turneu Amical Herăstrău (event 1)
  (1, 'a1000000-0000-0000-0000-000000000001', '2026-02-01T10:30:00Z'),
  (1, 'a1000000-0000-0000-0000-000000000002', '2026-02-02T09:00:00Z'),
  (1, 'a1000000-0000-0000-0000-000000000003', '2026-02-03T14:00:00Z'),
  (1, 'a1000000-0000-0000-0000-000000000005', '2026-02-05T11:00:00Z'),
  (1, 'a1000000-0000-0000-0000-000000000007', '2026-02-07T16:00:00Z'),
  (1, 'a1000000-0000-0000-0000-000000000010','2026-02-08T08:00:00Z'),
  -- Sesiune Casual Parcul Național (event 2)
  (2, 'a1000000-0000-0000-0000-000000000002', '2026-02-25T12:30:00Z'),
  (2, 'a1000000-0000-0000-0000-000000000001', '2026-02-26T10:00:00Z'),
  (2, 'a1000000-0000-0000-0000-000000000005', '2026-02-27T15:00:00Z'),
  -- Antrenament Dinamo (event 3)
  (3, 'a1000000-0000-0000-0000-000000000003', '2026-03-10T09:30:00Z'),
  (3, 'a1000000-0000-0000-0000-000000000001', '2026-03-11T10:00:00Z'),
  (3, 'a1000000-0000-0000-0000-000000000010','2026-03-12T14:00:00Z'),
  (3, 'a1000000-0000-0000-0000-000000000007', '2026-03-13T09:00:00Z'),
  -- Weekend Challenge Herăstrău (event 4 - upcoming)
  (4, 'a1000000-0000-0000-0000-000000000001', '2026-03-25T10:30:00Z'),
  (4, 'a1000000-0000-0000-0000-000000000002', '2026-03-25T14:00:00Z'),
  (4, 'a1000000-0000-0000-0000-000000000007', '2026-03-26T09:00:00Z'),
  -- Cupa Primăverii (event 5 - upcoming tournament)
  (5, 'a1000000-0000-0000-0000-000000000003', '2026-03-20T08:30:00Z'),
  (5, 'a1000000-0000-0000-0000-000000000001', '2026-03-21T10:00:00Z'),
  (5, 'a1000000-0000-0000-0000-000000000002', '2026-03-22T11:00:00Z'),
  (5, 'a1000000-0000-0000-0000-000000000005', '2026-03-23T14:00:00Z'),
  (5, 'a1000000-0000-0000-0000-000000000010','2026-03-24T09:00:00Z'),
  -- Ping Pong After Work (event 6)
  (6, 'a1000000-0000-0000-0000-000000000005', '2026-03-26T12:30:00Z'),
  (6, 'a1000000-0000-0000-0000-000000000001', '2026-03-26T15:00:00Z'),
  -- Dublu Mixt Parcul Tineretului (event 7 - confirmed)
  (7, 'a1000000-0000-0000-0000-000000000010','2026-03-22T14:30:00Z'),
  (7, 'a1000000-0000-0000-0000-000000000002', '2026-03-23T10:00:00Z'),
  (7, 'a1000000-0000-0000-0000-000000000001', '2026-03-24T08:00:00Z'),
  (7, 'a1000000-0000-0000-0000-000000000003', '2026-03-24T12:00:00Z'),
  (7, 'a1000000-0000-0000-0000-000000000005', '2026-03-25T09:00:00Z'),
  (7, 'a1000000-0000-0000-0000-000000000007', '2026-03-25T16:00:00Z')
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Note: Notification seed data is in 011_seed_notifications.sql (runs after notifications table is created)
-- Note: Views are regular views (auto-updating), no refresh needed
