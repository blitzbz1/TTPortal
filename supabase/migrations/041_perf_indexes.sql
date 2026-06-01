-- Index gaps surfaced by the round-7 perf audit. All five indexes are
-- additive, idempotent, and small enough on this dataset that plain
-- (non-CONCURRENT) creation is sub-second. Each one targets a query the
-- app issues frequently — see the perf report for the full mapping.

-- 1. notifications.sender_id — FK was added in migration 039 but Postgres
--    does not auto-index FK source columns. Required so the embed
--    `sender:profiles!notifications_sender_profiles_fk(...)` is fast.
--    Partial index: most rows have a sender, but skipping NULLs keeps it
--    a touch smaller and matches the typical access pattern.
CREATE INDEX IF NOT EXISTS idx_notifications_sender
  ON public.notifications(sender_id)
  WHERE sender_id IS NOT NULL;

-- 2. reviews(venue_id, created_at DESC) — getReviewsForVenue() filters by
--    venue_id and orders by created_at DESC; replaces an explicit sort.
CREATE INDEX IF NOT EXISTS idx_reviews_venue_created
  ON public.reviews(venue_id, created_at DESC);

-- 3. reviews flagged moderation — admin-tab `flagged = true` listing
--    sorted by flag_count DESC. Partial index keeps it cheap to maintain
--    while serving the only query that scans the flagged set.
CREATE INDEX IF NOT EXISTS idx_reviews_flagged
  ON public.reviews(flag_count DESC)
  WHERE flagged = true;

-- 4. events(status, starts_at) — every event-list query filters by status
--    (`NOT IN ('cancelled','completed')`) AND ranges starts_at against
--    now(). Compound lets the planner satisfy both with a single index.
CREATE INDEX IF NOT EXISTS idx_events_status_starts
  ON public.events(status, starts_at);

-- 5. checkins(user_id, started_at DESC) — getPlayHistory orders by
--    started_at DESC after filtering by user_id. The existing
--    idx_checkins_user_ended is on the wrong column for that sort.
CREATE INDEX IF NOT EXISTS idx_checkins_user_started
  ON public.checkins(user_id, started_at DESC);
