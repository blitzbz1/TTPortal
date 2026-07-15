CREATE TABLE IF NOT EXISTS public.equipment_catalog_manufacturers (
  category TEXT NOT NULL CHECK (category IN ('blade', 'rubber')),
  manufacturer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (category, manufacturer_id)
);

CREATE TABLE IF NOT EXISTS public.equipment_catalog_models (
  category TEXT NOT NULL CHECK (category IN ('blade', 'rubber')),
  manufacturer_id TEXT NOT NULL,
  model TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (category, manufacturer_id, model),
  FOREIGN KEY (category, manufacturer_id)
    REFERENCES public.equipment_catalog_manufacturers(category, manufacturer_id)
    ON DELETE CASCADE
);

ALTER TABLE public.equipment_catalog_manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_catalog_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read equipment catalog manufacturers" ON public.equipment_catalog_manufacturers;
CREATE POLICY "Anyone can read equipment catalog manufacturers"
  ON public.equipment_catalog_manufacturers
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can read equipment catalog models" ON public.equipment_catalog_models;
CREATE POLICY "Anyone can read equipment catalog models"
  ON public.equipment_catalog_models
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_equipment_catalog_models_lookup
  ON public.equipment_catalog_models(category, manufacturer_id, sort_order);

CREATE TABLE IF NOT EXISTS public.equipment_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blade_manufacturer_id TEXT NOT NULL,
  blade_manufacturer TEXT NOT NULL,
  blade_model TEXT NOT NULL,
  forehand_rubber_manufacturer_id TEXT NOT NULL,
  forehand_rubber_manufacturer TEXT NOT NULL,
  forehand_rubber_model TEXT NOT NULL,
  forehand_rubber_color TEXT NOT NULL CHECK (forehand_rubber_color IN ('red', 'black', 'pink', 'blue', 'purple', 'green')),
  backhand_rubber_manufacturer_id TEXT NOT NULL,
  backhand_rubber_manufacturer TEXT NOT NULL,
  backhand_rubber_model TEXT NOT NULL,
  backhand_rubber_color TEXT NOT NULL CHECK (backhand_rubber_color IN ('red', 'black')),
  dominant_hand TEXT NOT NULL CHECK (dominant_hand IN ('right', 'left')),
  playing_style TEXT NOT NULL CHECK (playing_style IN ('attacker', 'defender', 'all_rounder')),
  grip TEXT NOT NULL CHECK (grip IN ('shakehand', 'penhold', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.equipment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their equipment history"
  ON public.equipment_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their equipment history"
  ON public.equipment_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_equipment_history_user_created
  ON public.equipment_history(user_id, created_at DESC);
