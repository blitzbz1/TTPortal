-- Assign venue ownership from the authenticated database identity.
--
-- The venues INSERT policy requires submitted_by = auth.uid(), but clients can
-- omit that nullable column. Setting it in a BEFORE INSERT trigger keeps the
-- policy intact, fixes existing app builds, and prevents callers from claiming
-- a submission belongs to another user. The same boundary also owns moderation
-- state for regular users; admins retain their existing import/review powers.

CREATE OR REPLACE FUNCTION public.set_venue_submitted_by_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_city_name text;
BEGIN
  -- Preserve service-role/import behavior, where there is no authenticated
  -- user and submitted_by is intentionally NULL (or explicitly supplied).
  IF v_user_id IS NOT NULL THEN
    NEW.submitted_by := v_user_id;

    IF NOT public.is_current_user_admin() THEN
      NEW.name := btrim(coalesce(NEW.name, ''));
      NEW.address := btrim(coalesce(NEW.address, ''));
      NEW.description := nullif(btrim(coalesce(NEW.description, '')), '');

      IF length(NEW.name) < 1 OR length(NEW.name) > 100 THEN
        RAISE EXCEPTION 'invalid_venue_name' USING ERRCODE = '22023';
      END IF;
      IF length(NEW.address) < 1 THEN
        RAISE EXCEPTION 'invalid_venue_address' USING ERRCODE = '22023';
      END IF;
      IF NEW.lat IS NULL OR NOT (NEW.lat BETWEEN -90 AND 90)
         OR NEW.lng IS NULL OR NOT (NEW.lng BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'invalid_venue_coordinates' USING ERRCODE = '22023';
      END IF;
      IF NEW.tables_count IS NOT NULL
         AND (NEW.tables_count < 1 OR NEW.tables_count > 100) THEN
        RAISE EXCEPTION 'invalid_venue_tables_count' USING ERRCODE = '22023';
      END IF;

      SELECT c.name INTO v_city_name
      FROM public.cities c
      WHERE c.id = NEW.city_id;
      IF v_city_name IS NULL THEN
        RAISE EXCEPTION 'invalid_venue_city' USING ERRCODE = '22023';
      END IF;
      NEW.city := v_city_name;

      NEW.approved := false;
      NEW.verified := false;
      NEW.review_status := 'pending';
      NEW.duplicate_of_venue_id := NULL;
      NEW.needs_manual_pin := false;
      NEW.admin_review_notes := NULL;
      NEW.reviewed_at := NULL;
      NEW.reviewed_by := NULL;
      NEW.source := 'user';
      NEW.import_run_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_venue_submitted_by_from_auth ON public.venues;
CREATE TRIGGER set_venue_submitted_by_from_auth
  BEFORE INSERT ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_venue_submitted_by_from_auth();

COMMENT ON FUNCTION public.set_venue_submitted_by_from_auth() IS
  'Sets venue ownership from auth.uid() and pins regular-user rows to pending moderation state; leaves service-role/import inserts unchanged.';
