-- F060 — Training session log.
--
-- An owner-only personal log of solo/partner/multiball/robot practice
-- sessions. Mirrors equipment_history (024): a per-user append-only table
-- with owner-only RLS (read + insert both auth.uid() = user_id) and an index
-- on (user_id, created_at DESC). There is NO friend-read at the table level —
-- the client reads only its own rows directly via RLS (matching 024). If a
-- friend-visible surface is ever needed, layer it ABOVE this table with a
-- SECURITY DEFINER RPC that checks an accepted friendship (the 025 pattern).
--
-- training_sessions.hours is the third play-hours source (alongside checkin
-- durations and event_participants.hours_played) that get_profile_stats /
-- year_in_review already sum; the PlayHistory bundle reads these rows for the
-- window and surfaces a Training pill + per-day rows + a focus-distribution
-- bar. focus values ('serves','receive','footwork','fh_bh_loop','blocking',
-- 'match_play') are validated client-side; the DB CHECK only bounds the count
-- (<= 3) so the catalog can evolve without a migration.
--
-- Rate limit: a BEFORE INSERT trigger funnels every insert through the generic
-- enforce_rate_limit (047) with two windows seeded into rate_limit_config.

CREATE TABLE IF NOT EXISTS public.training_sessions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_type  TEXT NOT NULL CHECK (session_type IN ('solo', 'partner', 'multiball', 'robot')),
  hours         NUMERIC(4,1) NOT NULL CHECK (hours > 0 AND hours <= 24),
  focus         TEXT[] NOT NULL DEFAULT '{}'
                  CHECK (array_length(focus, 1) IS NULL OR array_length(focus, 1) <= 3),
  venue_id      INT REFERENCES public.venues(id) ON DELETE SET NULL,
  partner_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note          TEXT CHECK (note IS NULL OR char_length(note) <= 280),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their training sessions" ON public.training_sessions;
CREATE POLICY "Users can read their training sessions"
  ON public.training_sessions
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their training sessions" ON public.training_sessions;
CREATE POLICY "Users can insert their training sessions"
  ON public.training_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_training_sessions_user_created
  ON public.training_sessions(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.training_sessions TO authenticated;

-- ── Rate limit (047 / 125 pattern) ─────────────────────────────────────────
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('log_training', 'user',  3600, 20, '20 training logs per hour'),
  ('log_training', 'user', 86400, 60, '60 per day')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_enforce_log_training() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('log_training'); RETURN new; END $$;

DROP TRIGGER IF EXISTS rate_limit_log_training ON public.training_sessions;
CREATE TRIGGER rate_limit_log_training
  BEFORE INSERT ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_log_training();

NOTIFY pgrst, 'reload schema';
