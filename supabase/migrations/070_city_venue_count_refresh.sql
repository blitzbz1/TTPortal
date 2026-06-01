-- Keep city catalog metadata fresh when venues are created, approved,
-- rejected, moved between cities, or deleted. This makes newly approved
-- cities/countries show up through get_cities_delta without waiting for a
-- manual count-repair migration.

CREATE OR REPLACE FUNCTION public.refresh_city_venue_count(p_city_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_city_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.cities c
  SET venue_count = (
        SELECT COUNT(*)::integer
        FROM public.venues v
        WHERE v.city_id = p_city_id
          AND v.approved = true
      ),
      updated_at = now()
  WHERE c.id = p_city_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_refresh_city_venue_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_city_venue_count(NEW.city_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.refresh_city_venue_count(NEW.city_id);
    IF OLD.city_id IS DISTINCT FROM NEW.city_id THEN
      PERFORM public.refresh_city_venue_count(OLD.city_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_city_venue_count(OLD.city_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS venues_refresh_city_venue_count ON public.venues;
CREATE TRIGGER venues_refresh_city_venue_count
  AFTER INSERT OR UPDATE OF approved, city_id OR DELETE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_city_venue_count();

UPDATE public.cities c
SET venue_count = COALESCE(counts.venue_count, 0),
    updated_at = now()
FROM (
  SELECT c2.id, COUNT(v.id)::integer AS venue_count
  FROM public.cities c2
  LEFT JOIN public.venues v
    ON v.city_id = c2.id
   AND v.approved = true
  GROUP BY c2.id
) counts
WHERE c.id = counts.id
  AND c.venue_count IS DISTINCT FROM counts.venue_count;
