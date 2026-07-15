-- Admin venue review workflow fields for the city-first dashboard.
-- Non-destructive: these fields let admins classify staged/imported venues
-- without deleting or hiding rows by accident.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS duplicate_of_venue_id INTEGER REFERENCES public.venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS needs_manual_pin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.venues
  DROP CONSTRAINT IF EXISTS venues_review_status_check;

ALTER TABLE public.venues
  ADD CONSTRAINT venues_review_status_check CHECK (
    review_status IN (
      'pending',
      'approved',
      'hidden',
      'needs_manual_pin',
      'duplicate_candidate',
      'rejected'
    )
  );

CREATE INDEX IF NOT EXISTS idx_venues_review_status
  ON public.venues(review_status);

CREATE INDEX IF NOT EXISTS idx_venues_duplicate_of_venue_id
  ON public.venues(duplicate_of_venue_id)
  WHERE duplicate_of_venue_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.venue_admin_audit (
  id BIGSERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_admin_audit_venue_created
  ON public.venue_admin_audit(venue_id, created_at DESC);

ALTER TABLE public.venue_admin_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_admin_audit_select_admin ON public.venue_admin_audit;
CREATE POLICY venue_admin_audit_select_admin ON public.venue_admin_audit
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS venue_admin_audit_insert_admin ON public.venue_admin_audit;
CREATE POLICY venue_admin_audit_insert_admin ON public.venue_admin_audit
  FOR INSERT WITH CHECK (public.is_current_user_admin());

CREATE OR REPLACE FUNCTION public.admin_set_venue_review_state(
  p_venue_id INTEGER,
  p_review_status TEXT DEFAULT NULL,
  p_duplicate_of_venue_id INTEGER DEFAULT NULL,
  p_needs_manual_pin BOOLEAN DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_approved BOOLEAN DEFAULT NULL
)
RETURNS public.venues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_after public.venues;
  v_status TEXT;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_review_status IS NOT NULL
    AND p_review_status NOT IN (
      'pending',
      'approved',
      'hidden',
      'needs_manual_pin',
      'duplicate_candidate',
      'rejected'
    ) THEN
    RAISE EXCEPTION 'Invalid review status: %', p_review_status;
  END IF;

  SELECT to_jsonb(v)
  INTO v_before
  FROM public.venues v
  WHERE v.id = p_venue_id;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Venue not found: %', p_venue_id;
  END IF;

  v_status := COALESCE(p_review_status, v_before->>'review_status', 'pending');

  UPDATE public.venues
  SET
    review_status = v_status,
    duplicate_of_venue_id = CASE
      WHEN v_status = 'duplicate_candidate' THEN p_duplicate_of_venue_id
      ELSE NULL
    END,
    needs_manual_pin = COALESCE(
      p_needs_manual_pin,
      CASE WHEN v_status = 'needs_manual_pin' THEN true ELSE needs_manual_pin END
    ),
    admin_review_notes = NULLIF(trim(COALESCE(p_notes, admin_review_notes, '')), ''),
    approved = COALESCE(
      p_approved,
      CASE
        WHEN v_status = 'approved' THEN true
        WHEN v_status IN ('hidden', 'rejected') THEN false
        ELSE approved
      END
    ),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  WHERE id = p_venue_id
  RETURNING *
  INTO v_after;

  INSERT INTO public.venue_admin_audit(
    venue_id,
    admin_id,
    action,
    before_state,
    after_state,
    note
  )
  VALUES (
    p_venue_id,
    auth.uid(),
    'set_review_state',
    v_before,
    to_jsonb(v_after),
    p_notes
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_venue_review_state(
  INTEGER,
  TEXT,
  INTEGER,
  BOOLEAN,
  TEXT,
  BOOLEAN
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_bulk_set_venue_review_state(
  p_venue_ids INTEGER[],
  p_review_status TEXT,
  p_approved BOOLEAN DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (venue_id INTEGER, review_status TEXT, approved BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id INTEGER;
  v_updated public.venues;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF COALESCE(array_length(p_venue_ids, 1), 0) > 250 THEN
    RAISE EXCEPTION 'Bulk review is limited to 250 venues at a time';
  END IF;

  FOREACH v_id IN ARRAY COALESCE(p_venue_ids, ARRAY[]::INTEGER[]) LOOP
    SELECT *
    INTO v_updated
    FROM public.admin_set_venue_review_state(
      v_id,
      p_review_status,
      NULL,
      NULL,
      p_notes,
      p_approved
    );

    venue_id := v_updated.id;
    review_status := v_updated.review_status;
    approved := v_updated.approved;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_set_venue_review_state(
  INTEGER[],
  TEXT,
  BOOLEAN,
  TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';
