-- Delta-sync support for two more reference catalogs: cities and the
-- equipment catalog (manufacturers + models). Same pattern as venues
-- (migration 045): updated_at + tombstone table + RPC returning a JSONB
-- bundle of upserts/tombstone_ids/synced_at.
--
-- Both data sets are mostly-static reference data fetched from many
-- screens. Persistent on-device cache + delta sync turns warm visits
-- into zero-row round-trips.

-- ─────────────────────────────────────────────────────────────────
-- 1. cities
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS cities_set_updated_at ON public.cities;
CREATE TRIGGER cities_set_updated_at
  BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cities_updated_at
  ON public.cities(updated_at);

CREATE TABLE IF NOT EXISTS public.city_tombstones (
  city_id    INTEGER     PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_city_tombstones_deleted_at
  ON public.city_tombstones(deleted_at);

CREATE OR REPLACE FUNCTION public.tg_record_city_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.city_tombstones(city_id, deleted_at)
  VALUES (OLD.id, now())
  ON CONFLICT (city_id) DO UPDATE SET deleted_at = EXCLUDED.deleted_at;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cities_record_deletion ON public.cities;
CREATE TRIGGER cities_record_deletion
  BEFORE DELETE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.tg_record_city_deletion();

ALTER TABLE public.city_tombstones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS city_tombstones_select ON public.city_tombstones;
CREATE POLICY city_tombstones_select ON public.city_tombstones
  FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.get_cities_delta(p_since TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now        TIMESTAMPTZ := now();
  v_upserts    JSONB;
  v_tombstones JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(rec)), '[]'::jsonb)
  INTO v_upserts
  FROM (
    SELECT id, name, county, lat, lng, zoom, venue_count, active, updated_at
    FROM public.cities
    WHERE active = true
      AND (p_since IS NULL OR updated_at > p_since)
  ) rec;

  SELECT COALESCE(jsonb_agg(DISTINCT t.city_id), '[]'::jsonb)
  INTO v_tombstones
  FROM (
    SELECT city_id FROM public.city_tombstones
    WHERE p_since IS NULL OR deleted_at > p_since
    UNION ALL
    SELECT id AS city_id FROM public.cities
    WHERE active = false
      AND (p_since IS NULL OR updated_at > p_since)
  ) t;

  RETURN jsonb_build_object(
    'upserts',       v_upserts,
    'tombstone_ids', v_tombstones,
    'synced_at',     v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cities_delta(TIMESTAMPTZ) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────
-- 2. equipment catalog (manufacturers + models, single bundle)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.equipment_catalog_manufacturers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.equipment_catalog_models
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS ec_manufacturers_set_updated_at
  ON public.equipment_catalog_manufacturers;
CREATE TRIGGER ec_manufacturers_set_updated_at
  BEFORE UPDATE ON public.equipment_catalog_manufacturers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS ec_models_set_updated_at
  ON public.equipment_catalog_models;
CREATE TRIGGER ec_models_set_updated_at
  BEFORE UPDATE ON public.equipment_catalog_models
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ec_manufacturers_category_updated
  ON public.equipment_catalog_manufacturers(category, updated_at);
CREATE INDEX IF NOT EXISTS idx_ec_models_category_updated
  ON public.equipment_catalog_models(category, updated_at);

-- Tombstones: composite key (category, manufacturer_id[, model])
CREATE TABLE IF NOT EXISTS public.ec_manufacturer_tombstones (
  category        TEXT NOT NULL,
  manufacturer_id TEXT NOT NULL,
  deleted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (category, manufacturer_id)
);

CREATE TABLE IF NOT EXISTS public.ec_model_tombstones (
  category        TEXT NOT NULL,
  manufacturer_id TEXT NOT NULL,
  model           TEXT NOT NULL,
  deleted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (category, manufacturer_id, model)
);

CREATE INDEX IF NOT EXISTS idx_ec_manufacturer_tombstones_deleted_at
  ON public.ec_manufacturer_tombstones(deleted_at);
CREATE INDEX IF NOT EXISTS idx_ec_model_tombstones_deleted_at
  ON public.ec_model_tombstones(deleted_at);

ALTER TABLE public.ec_manufacturer_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_model_tombstones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ec_manufacturer_tombstones_select
  ON public.ec_manufacturer_tombstones;
CREATE POLICY ec_manufacturer_tombstones_select
  ON public.ec_manufacturer_tombstones
  FOR SELECT USING (true);
DROP POLICY IF EXISTS ec_model_tombstones_select
  ON public.ec_model_tombstones;
CREATE POLICY ec_model_tombstones_select
  ON public.ec_model_tombstones
  FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.tg_record_ec_manufacturer_deletion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ec_manufacturer_tombstones(category, manufacturer_id, deleted_at)
  VALUES (OLD.category, OLD.manufacturer_id, now())
  ON CONFLICT (category, manufacturer_id) DO UPDATE SET deleted_at = EXCLUDED.deleted_at;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_record_ec_model_deletion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ec_model_tombstones(category, manufacturer_id, model, deleted_at)
  VALUES (OLD.category, OLD.manufacturer_id, OLD.model, now())
  ON CONFLICT (category, manufacturer_id, model) DO UPDATE SET deleted_at = EXCLUDED.deleted_at;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS ec_manufacturers_record_deletion
  ON public.equipment_catalog_manufacturers;
CREATE TRIGGER ec_manufacturers_record_deletion
  BEFORE DELETE ON public.equipment_catalog_manufacturers
  FOR EACH ROW EXECUTE FUNCTION public.tg_record_ec_manufacturer_deletion();

DROP TRIGGER IF EXISTS ec_models_record_deletion
  ON public.equipment_catalog_models;
CREATE TRIGGER ec_models_record_deletion
  BEFORE DELETE ON public.equipment_catalog_models
  FOR EACH ROW EXECUTE FUNCTION public.tg_record_ec_model_deletion();

-- Bundled delta RPC: returns both manufacturer + model upserts in a
-- single round-trip, plus tombstones for each.
CREATE OR REPLACE FUNCTION public.get_equipment_catalog_delta(
  p_category TEXT,
  p_since    TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now              TIMESTAMPTZ := now();
  v_manuf_upserts    JSONB;
  v_model_upserts    JSONB;
  v_manuf_tombstones JSONB;
  v_model_tombstones JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(rec) ORDER BY (rec.sort_order)), '[]'::jsonb)
  INTO v_manuf_upserts
  FROM (
    SELECT category, manufacturer_id, name, sort_order, updated_at
    FROM public.equipment_catalog_manufacturers
    WHERE category = p_category
      AND (p_since IS NULL OR updated_at > p_since)
  ) rec;

  SELECT COALESCE(jsonb_agg(to_jsonb(rec) ORDER BY (rec.sort_order)), '[]'::jsonb)
  INTO v_model_upserts
  FROM (
    SELECT category, manufacturer_id, model, sort_order, updated_at
    FROM public.equipment_catalog_models
    WHERE category = p_category
      AND (p_since IS NULL OR updated_at > p_since)
  ) rec;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'manufacturer_id', manufacturer_id)), '[]'::jsonb)
  INTO v_manuf_tombstones
  FROM public.ec_manufacturer_tombstones
  WHERE category = p_category
    AND (p_since IS NULL OR deleted_at > p_since);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'manufacturer_id', manufacturer_id, 'model', model)), '[]'::jsonb)
  INTO v_model_tombstones
  FROM public.ec_model_tombstones
  WHERE category = p_category
    AND (p_since IS NULL OR deleted_at > p_since);

  RETURN jsonb_build_object(
    'manufacturer_upserts',    v_manuf_upserts,
    'model_upserts',           v_model_upserts,
    'manufacturer_tombstones', v_manuf_tombstones,
    'model_tombstones',        v_model_tombstones,
    'synced_at',               v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_equipment_catalog_delta(TEXT, TIMESTAMPTZ)
  TO authenticated, anon;
