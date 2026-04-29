-- Reverts 048_map_venues_rpc.sql.
--
-- Why: get_venues_delta (added in 045) already does what get_map_venues
-- aimed to do, but better — it returns only changed rows since the last
-- client sync rather than a fresh full-list payload every call. The
-- single direct caller of getVenues (VenuePickerModal) was migrated to
-- read from the delta-synced cache via useVenuesQuery, leaving
-- get_map_venues with no consumers.
drop function if exists public.get_map_venues(text, text);
