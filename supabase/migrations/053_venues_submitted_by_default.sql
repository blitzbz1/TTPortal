-- Set submitted_by server-side from auth.uid() instead of trusting the client.
-- The previous flow had the client send `submitted_by: user.id` and relied on
-- the RLS WITH CHECK (`auth.uid() = submitted_by`) to validate. That breaks
-- whenever the client-side user object and the JWT's sub disagree (e.g. a
-- stale session on web), surfacing as an opaque 403. Defaulting the column
-- from `auth.uid()` removes the failure mode: the client no longer needs to
-- supply the field, and the WITH CHECK can never fail because the value is
-- always taken from the verified JWT.
ALTER TABLE public.venues
  ALTER COLUMN submitted_by SET DEFAULT auth.uid();
