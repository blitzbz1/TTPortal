-- Feature requests board for the public web portal.
-- Users can suggest features and vote them up. Admins can update status or delete.

CREATE TABLE IF NOT EXISTS public.feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 5000),
  category TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'under_review'
    CHECK (status IN ('under_review', 'planned', 'in_progress', 'released')),
  vote_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_requests_status_idx ON public.feature_requests (status);
CREATE INDEX IF NOT EXISTS feature_requests_created_at_idx ON public.feature_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS feature_requests_vote_count_idx ON public.feature_requests (vote_count DESC);

CREATE TABLE IF NOT EXISTS public.feature_request_votes (
  feature_request_id UUID NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (feature_request_id, user_id)
);

CREATE INDEX IF NOT EXISTS feature_request_votes_user_idx ON public.feature_request_votes (user_id);

-- Maintain vote_count on the parent row.
CREATE OR REPLACE FUNCTION public.feature_request_votes_sync_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feature_requests
      SET vote_count = vote_count + 1
      WHERE id = NEW.feature_request_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feature_requests
      SET vote_count = GREATEST(vote_count - 1, 0)
      WHERE id = OLD.feature_request_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_request_votes_sync_count_trg ON public.feature_request_votes;
CREATE TRIGGER feature_request_votes_sync_count_trg
  AFTER INSERT OR DELETE ON public.feature_request_votes
  FOR EACH ROW EXECUTE FUNCTION public.feature_request_votes_sync_count();

-- updated_at trigger on feature_requests.
CREATE OR REPLACE FUNCTION public.feature_requests_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_requests_touch_updated_at_trg ON public.feature_requests;
CREATE TRIGGER feature_requests_touch_updated_at_trg
  BEFORE UPDATE ON public.feature_requests
  FOR EACH ROW EXECUTE FUNCTION public.feature_requests_touch_updated_at();

-- RLS
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_request_votes ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read feature requests.
DROP POLICY IF EXISTS "Feature requests are readable by everyone" ON public.feature_requests;
CREATE POLICY "Feature requests are readable by everyone"
  ON public.feature_requests FOR SELECT
  USING (true);

-- Authenticated users can submit a request.
DROP POLICY IF EXISTS "Authenticated users can insert feature requests" ON public.feature_requests;
CREATE POLICY "Authenticated users can insert feature requests"
  ON public.feature_requests FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Authors can edit or delete their own request (only while still under review).
DROP POLICY IF EXISTS "Authors can update their own feature request" ON public.feature_requests;
CREATE POLICY "Authors can update their own feature request"
  ON public.feature_requests FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND status = 'under_review')
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors can delete their own feature request" ON public.feature_requests;
CREATE POLICY "Authors can delete their own feature request"
  ON public.feature_requests FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND status = 'under_review');

-- Admins can update or delete any feature request.
DROP POLICY IF EXISTS "Admins can update any feature request" ON public.feature_requests;
CREATE POLICY "Admins can update any feature request"
  ON public.feature_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins can delete any feature request" ON public.feature_requests;
CREATE POLICY "Admins can delete any feature request"
  ON public.feature_requests FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Votes: readable by everyone (for counts), writable by the voter.
DROP POLICY IF EXISTS "Votes are readable by everyone" ON public.feature_request_votes;
CREATE POLICY "Votes are readable by everyone"
  ON public.feature_request_votes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own vote" ON public.feature_request_votes;
CREATE POLICY "Users can insert their own vote"
  ON public.feature_request_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove their own vote" ON public.feature_request_votes;
CREATE POLICY "Users can remove their own vote"
  ON public.feature_request_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());
