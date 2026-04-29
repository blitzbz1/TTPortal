-- Allow authenticated users to insert new cities via upsertCity().
-- Required for both the add-venue flow and the admin edit flow when an
-- address lookup resolves to a city that isn't in the seeded list yet.

DROP POLICY IF EXISTS "Authenticated users can insert cities" ON public.cities;
CREATE POLICY "Authenticated users can insert cities"
  ON public.cities FOR INSERT TO authenticated
  WITH CHECK (true);
