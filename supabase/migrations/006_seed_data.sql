-- Migration: 006_seed_data
-- Seed cities and core sample venues for development.

-- Cities
INSERT INTO public.cities (name, county, lat, lng, zoom, venue_count, active) VALUES
  ('București', 'București', 44.4268, 26.1025, 12, 0, true),
  ('Cluj-Napoca', 'Cluj', 46.7712, 23.6236, 13, 0, true),
  ('Timișoara', 'Timiș', 45.7489, 21.2087, 13, 0, true),
  ('Iași', 'Iași', 47.1585, 27.6014, 13, 0, true),
  ('Brașov', 'Brașov', 45.6427, 25.5887, 13, 0, true),
  ('Constanța', 'Constanța', 44.1598, 28.6348, 13, 0, true),
  ('Craiova', 'Dolj', 44.3302, 23.7949, 13, 0, true),
  ('Oradea', 'Bihor', 47.0465, 21.9189, 13, 0, true),
  ('Galați', 'Galați', 45.4353, 28.0080, 13, 0, true),
  ('Ploiești', 'Prahova', 44.9362, 26.0138, 13, 0, true),
  ('Târgu Mureș', 'Mureș', 46.5386, 24.5578, 13, 0, true),
  ('Bacău', 'Bacău', 46.5670, 26.9146, 13, 0, true),
  ('Pitești', 'Argeș', 44.8565, 24.8694, 13, 0, true),
  ('Arad', 'Arad', 46.1866, 21.3123, 13, 0, true),
  ('Sibiu', 'Sibiu', 45.7983, 24.1256, 13, 0, true)
ON CONFLICT (name) DO NOTHING;

-- Core sample venues in București
INSERT INTO public.venues (name, type, city, county, address, lat, lng, tables_count, condition, free_access, night_lighting, nets, verified, approved, created_at) VALUES
  ('Parcul Național', 'parc_exterior', 'București', 'București', 'Bd. Ferdinand nr. 1', 44.4350, 26.1120, 4, 'buna', true, false, true, true, true, '2026-03-28T10:52:58.175738+00:00'),
  ('Sala Sporturilor Titan', 'sala_indoor', 'București', 'București', 'Bd. Liviu Rebreanu nr. 2', 44.4180, 26.1510, 8, 'profesionala', false, true, true, true, true, '2026-03-28T10:52:58.175738+00:00'),
  ('Parcul IOR', 'parc_exterior', 'București', 'București', 'Bd. Camil Ressu', 44.4145, 26.1370, 2, 'acceptabila', true, false, false, false, true, '2026-03-28T10:52:58.175738+00:00'),
  ('Parcul Herăstrău', 'parc_exterior', 'București', 'București', 'Aleea Privighetorilor', 44.4740, 26.0780, 6, 'buna', true, true, true, true, true, '2026-03-28T10:52:58.175738+00:00'),
  ('Club Sportiv Dinamo', 'sala_indoor', 'București', 'București', 'Șos. Ștefan cel Mare nr. 7-9', 44.4530, 26.1160, 16, 'profesionala', false, true, true, true, true, '2026-03-28T10:52:58.175738+00:00')
ON CONFLICT (name, city) DO NOTHING;

-- Update city venue count
UPDATE public.cities
SET venue_count = (
  SELECT COUNT(*) FROM public.venues WHERE venues.city = cities.name AND venues.approved = true
);
