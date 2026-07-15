-- Migration: 092_storage_policies
-- Storage RLS for the venue-photos bucket, in source control, with the
-- daily image cap enforced SERVER-SIDE.
--
-- ⚠ OPERATOR STEP BEFORE PROD APPLY: the cloud bucket's current policies
-- were configured via the dashboard and are not in the repo. Diff them
-- against this file (Dashboard → Storage → policies, or
-- `select * from pg_policies where schemaname = 'storage'`) and reconcile
-- — this migration drops the known dashboard-era policy names it
-- supersedes, but unknown ad-hoc policies must be reviewed by hand.
--
-- What this encodes:
-- - public read (the app serves photos via public URLs),
-- - authenticated INSERT only into the three app-managed prefixes
--   (venues/, change-requests/, condition-votes/), owner-stamped,
-- - the 10/day cap re-checked INSIDE the INSERT policy by counting the
--   user's storage.objects rows in the last 24h — the client's
--   record_image_upload() RPC (080) remains for friendly pre-flight
--   errors/UX copy, but is no longer the enforcement point (a malicious
--   client skipping the RPC now hits this policy),
-- - no UPDATE/DELETE for regular users (uploads are immutable,
--   timestamp-named; admin cleanup runs via service_role/dashboard).
--
-- Size limits: enforced at the bucket level (file_size_limit) — policies
-- cannot see the payload size. Set via:
--   update storage.buckets
--      set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp']
--    where id = 'venue-photos';
-- (included below, no-op if the bucket is missing locally).

-- Bucket settings (idempotent; skipped when the bucket or the settings
-- columns don't exist — older storage schemas in local replay images lack
-- file_size_limit/allowed_mime_types).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets'
      AND column_name = 'file_size_limit'
  ) THEN
    EXECUTE $sql$
      UPDATE storage.buckets
         SET public = true,
             file_size_limit = 5242880,
             allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
       WHERE id = 'venue-photos'
    $sql$;
  END IF;
END $$;

-- Known historical policy names for this bucket (dashboard-era + this
-- migration's own names for idempotency).
-- 2026-06-11 prod diff (operator step, done via pg_policies): the live
-- dashboard-era names are "Public read photos" and — critically —
-- "Public upload photos", an INSERT policy for the PUBLIC role with only
-- a bucket check. Policies are permissive-OR: leaving it in place would
-- bypass every restriction below, so it must be dropped here.
DROP POLICY IF EXISTS "Public read photos"                  ON storage.objects;
DROP POLICY IF EXISTS "Public upload photos"                ON storage.objects;
DROP POLICY IF EXISTS "Public read venue photos"            ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload venue photos"   ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view venue photos"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload venue photos" ON storage.objects;

CREATE POLICY "Public read venue photos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'venue-photos');

CREATE POLICY "Authenticated upload venue photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'venue-photos'
    -- App-managed prefixes only: venues/<id>/…, change-requests/<id>/…,
    -- condition-votes/<id>/… (second path segment must exist).
    AND (storage.foldername(name))[1] IN ('venues', 'change-requests', 'condition-votes')
    AND array_length(storage.foldername(name), 1) >= 2
    -- Server-side daily cap: mirrors rate_limit_config('upload_image'),
    -- counting actual Storage writes so skipping the RPC doesn't help.
    AND (
      SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'venue-photos'
        AND o.owner = auth.uid()
        AND o.created_at > now() - interval '24 hours'
    ) < 10
  );

-- No UPDATE/DELETE policies for authenticated: uploads are immutable
-- (unique timestamped names; upsert: false in every client path).
