-- Add city_id column (temporarily nullable for the backfill)
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS city_id INT REFERENCES public.cities(id) ON DELETE RESTRICT;

-- Insert any cities referenced by existing venues that are missing from the cities table
INSERT INTO public.cities (name, active)
SELECT DISTINCT v.city, true
FROM public.venues v
LEFT JOIN public.cities c ON c.name = v.city
WHERE c.id IS NULL AND v.city IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Backfill city_id for all existing venues
UPDATE public.venues v
SET city_id = c.id
FROM public.cities c
WHERE v.city = c.name
  AND v.city_id IS NULL;

-- Now that every row has a city_id, make it NOT NULL
ALTER TABLE public.venues ALTER COLUMN city_id SET NOT NULL;

-- Index for FK lookups
CREATE INDEX IF NOT EXISTS idx_venues_city_id ON public.venues(city_id);
