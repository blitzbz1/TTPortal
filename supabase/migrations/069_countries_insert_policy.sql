-- Allow authenticated users to create country rows when a submitted venue
-- is in a country that has not been seeded yet.

DROP POLICY IF EXISTS "Authenticated users can insert countries" ON public.countries;
CREATE POLICY "Authenticated users can insert countries"
  ON public.countries FOR INSERT TO authenticated
  WITH CHECK (true);
