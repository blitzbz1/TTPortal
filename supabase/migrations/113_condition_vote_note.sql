-- Migration: 113_condition_vote_note
-- The merged "Suggest an edit" sheet (formerly a standalone condition-vote
-- screen) lets a user attach an explanatory note to a table-condition rating —
-- e.g. "left leg wobbly" next to a "Damaged" vote. condition_votes already
-- stores a photo_url; give free text the same home with a nullable note column.
-- The client trims blank notes to NULL and caps length at 500; we bound it
-- server-side too. Writes are covered by the existing row-level INSERT/UPDATE
-- policies (004/086) — condition_votes uses RLS, not per-column grants — so no
-- grant changes are required.

-- 1. Column ----------------------------------------------------------------
ALTER TABLE public.condition_votes
  ADD COLUMN IF NOT EXISTS note text;

-- 2. Bound the length (client caps at 500; allow headroom). Existing rows are
--    all NULL, so the constraint validates immediately. Guarded so the
--    migration is re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'condition_votes_note_len'
  ) THEN
    ALTER TABLE public.condition_votes
      ADD CONSTRAINT condition_votes_note_len
      CHECK (note IS NULL OR char_length(note) <= 1000);
  END IF;
END $$;
