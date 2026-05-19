-- Future-proof city map centering.
--
-- Visible cities must have a map center (`lat`, `lng`) and a city-scale zoom.
-- This prevents newly added countries/cities from appearing in the welcome
-- selector while the map has to fall back to Bucuresti.

BEGIN;

UPDATE public.cities
SET zoom = 12,
    updated_at = now()
WHERE zoom IS NULL
  AND lat IS NOT NULL
  AND lng IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_require_visible_city_map_center()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.active = true
     AND COALESCE(NEW.expansion_status, 'active') <> 'hidden'
     AND (NEW.lat IS NULL OR NEW.lng IS NULL OR NEW.zoom IS NULL) THEN
    RAISE EXCEPTION
      'Visible city % (%) must include lat, lng, and zoom before it can be shown',
      NEW.name,
      COALESCE(NEW.country_code, 'unknown')
      USING ERRCODE = '23514';
  END IF;

  IF NEW.lat IS NOT NULL AND (NEW.lat < -90 OR NEW.lat > 90) THEN
    RAISE EXCEPTION 'City latitude % is outside valid range', NEW.lat
      USING ERRCODE = '22003';
  END IF;

  IF NEW.lng IS NOT NULL AND (NEW.lng < -180 OR NEW.lng > 180) THEN
    RAISE EXCEPTION 'City longitude % is outside valid range', NEW.lng
      USING ERRCODE = '22003';
  END IF;

  IF NEW.zoom IS NOT NULL AND (NEW.zoom < 8 OR NEW.zoom > 14) THEN
    RAISE EXCEPTION 'City zoom % should be city-scale, between 8 and 14', NEW.zoom
      USING ERRCODE = '22003';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_visible_city_map_center ON public.cities;
CREATE TRIGGER require_visible_city_map_center
  BEFORE INSERT OR UPDATE OF active, expansion_status, lat, lng, zoom
  ON public.cities
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_require_visible_city_map_center();

COMMENT ON FUNCTION public.tg_require_visible_city_map_center() IS
  'Prevents visible city rows from being inserted or updated without map center coordinates and city-scale zoom.';

COMMIT;
