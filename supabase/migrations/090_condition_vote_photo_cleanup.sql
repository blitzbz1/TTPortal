-- Migration: 090_condition_vote_photo_cleanup
-- ConditionVotingScreen used to write the device-local picker URI straight
-- into condition_votes.photo_url — a dead file:// path no other device can
-- render. The client now uploads to Storage first (condition-votes/ path in
-- the venue-photos bucket) and stores the public URL.
--
-- One-off cleanup: NULL out the dead local URIs.

UPDATE public.condition_votes
SET photo_url = NULL
WHERE photo_url LIKE 'file:%'
   OR photo_url LIKE 'content:%'
   OR photo_url LIKE 'ph://%'
   OR photo_url LIKE 'assets-library:%';
