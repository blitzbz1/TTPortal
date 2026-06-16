-- 114 — notifications.type CHECK backfill.
-- Verifies the constraint accepts the types shipped by 105/112 (match + venue
-- board) that 033 omitted, and still rejects an unknown type.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(3);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('5a000000-0000-4000-8000-000000000001', 'ntype-a@example.com', '{"full_name":"A"}'::jsonb);

-- (1)/(2) the previously-rejected, now-shipped types insert cleanly.
SELECT extensions.lives_ok(
  $q$ INSERT INTO public.notifications (recipient_id, type, title, body)
      VALUES ('5a000000-0000-4000-8000-000000000001', 'match_confirm', 'T', 'B') $q$,
  'notifications accepts a match_confirm type (105)'
);

SELECT extensions.lives_ok(
  $q$ INSERT INTO public.notifications (recipient_id, type, title, body)
      VALUES ('5a000000-0000-4000-8000-000000000001', 'venue_post_reply', 'T', 'B') $q$,
  'notifications accepts a venue_post_reply type (112)'
);

-- (3) the constraint is still enforced for unknown types.
SELECT extensions.throws_ok(
  $q$ INSERT INTO public.notifications (recipient_id, type, title, body)
      VALUES ('5a000000-0000-4000-8000-000000000001', 'definitely_not_a_type', 'T', 'B') $q$,
  '23514', NULL,
  'an unknown notification type is still rejected by the CHECK'
);

SELECT extensions.finish();
ROLLBACK;
