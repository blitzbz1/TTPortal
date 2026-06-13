-- Migration: 101_drop_vestigial_tables (T021)
-- Drops the dashboard-era tables that existed ONLY on prod (never in the
-- migration chain) — the standing schema drift. Verified 2026-06-11:
--   check_ins, messages, friendships_old, reviews_old,
--   preferred_locations           → 0 rows
--   cities_old (15), venues_old (62), event_messages (12)
--     → exported to backups/drift-export-2026-06-11/ before dropping
--     (pre-056-rename snapshots + an abandoned chat experiment).
-- IF EXISTS keeps this a no-op on fresh chain replays, where these tables
-- never existed. Prod-only FUNCTIONS (close_event, get_venues_in_bounds,
-- get_venues_in_viewport, haversine_m) are intentionally NOT dropped —
-- pre-097 app builds may still call them; remove alongside 099's shims.

DROP TABLE IF EXISTS public.check_ins CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.event_messages CASCADE;
DROP TABLE IF EXISTS public.friendships_old CASCADE;
DROP TABLE IF EXISTS public.reviews_old CASCADE;
DROP TABLE IF EXISTS public.cities_old CASCADE;
DROP TABLE IF EXISTS public.venues_old CASCADE;
DROP TABLE IF EXISTS public.preferred_locations CASCADE;
