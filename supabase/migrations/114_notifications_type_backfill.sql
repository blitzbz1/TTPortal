-- Migration: 114_notifications_type_backfill (Phase-3 prerequisite / bugfix)
-- The notifications.type CHECK constraint was last set in 033_feedback_replies
-- and never updated when later features began sending new notification types:
--   - 105_matches:     'match_confirm' / 'match_confirmed' / 'match_disputed'
--   - 112_venue_posts: 'venue_post_reply'
-- create_and_send_notification (097) does a plain INSERT into notifications, so
-- any cross-user match confirmation/dispute or venue-board answer would raise a
-- check_violation and roll back the whole action. The shipped tests miss it: the
-- venue-board pgTAP only posts a SELF reply (which the RPC skips notifying) and
-- the matches harness checks the category mapping, not an actual insert.
--
-- This migration backfills the constraint to match what is actually sent today.
-- Subsequent Phase-3 migrations (115/116/118) extend it further with their own
-- types, each reproducing the full list. 033 is frozen — fixed here, not there.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'event_invite', 'event_update',
    'event_feedback_request', 'event_feedback_received',
    'checkin_nearby',
    'review_on_venue',
    'feedback_reply',
    -- backfilled (in use since 105/112, previously rejected):
    'match_confirm', 'match_confirmed', 'match_disputed',
    'venue_post_reply'
  ));
