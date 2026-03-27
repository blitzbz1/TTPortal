-- Migration: 006_seed_data
-- Seed cities and sample venues for development.

-- Cities
INSERT INTO public.cities (name, county, lat, lng, zoom, venue_count, active) VALUES
  ('București', 'București', 44.4268, 26.1025, 12, 54, true),
  ('Cluj-Napoca', 'Cluj', 46.7712, 23.6236, 13, 28, true),
  ('Timișoara', 'Timiș', 45.7489, 21.2087, 13, 19, true),
  ('Iași', 'Iași', 47.1585, 27.6014, 13, 15, true),
  ('Brașov', 'Brașov', 45.6427, 25.5887, 13, 12, true),
  ('Constanța', 'Constanța', 44.1598, 28.6348, 13, 10, true),
  ('Craiova', 'Dolj', 44.3302, 23.7949, 13, 8, true),
  ('Oradea', 'Bihor', 47.0465, 21.9189, 13, 6, true)
ON CONFLICT (name) DO NOTHING;

-- Sample venues in București
INSERT INTO public.venues (name, type, city, county, address, lat, lng, tables_count, condition, free_access, night_lighting, nets, verified, approved) VALUES
  ('Parcul Național', 'parc_exterior', 'București', 'București', 'Bd. Ferdinand nr. 1', 44.4350, 26.1120, 4, 'buna', true, false, true, true, true),
  ('Sala Sporturilor Titan', 'sala_indoor', 'București', 'București', 'Bd. Liviu Rebreanu nr. 2', 44.4180, 26.1510, 8, 'profesionala', false, true, true, true, true),
  ('Parcul IOR', 'parc_exterior', 'București', 'București', 'Bd. Camil Ressu', 44.4145, 26.1370, 2, 'acceptabila', true, false, false, false, true),
  ('Parcul Herăstrău', 'parc_exterior', 'București', 'București', 'Aleea Privighetorilor', 44.4740, 26.0780, 6, 'buna', true, true, true, true, true),
  ('Club Sportiv Dinamo', 'sala_indoor', 'București', 'București', 'Șos. Ștefan cel Mare nr. 7-9', 44.4530, 26.1160, 16, 'profesionala', false, true, true, true, true)
ON CONFLICT (name, city) DO NOTHING;

-- Update city venue count
UPDATE public.cities SET venue_count = (
  SELECT COUNT(*) FROM public.venues WHERE venues.city = cities.name AND venues.approved = true
);
