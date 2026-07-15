-- In-app user feedback (bug reports and general feedback).
-- Feature requests use the existing public.feature_requests table.

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page TEXT NOT NULL CHECK (char_length(page) BETWEEN 1 AND 200),
  category TEXT NOT NULL CHECK (category IN ('bug', 'general')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_feedback_user_idx ON public.user_feedback (user_id);
CREATE INDEX IF NOT EXISTS user_feedback_created_at_idx ON public.user_feedback (created_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Authors can read their own feedback.
DROP POLICY IF EXISTS "Users can read their own feedback" ON public.user_feedback;
CREATE POLICY "Users can read their own feedback"
  ON public.user_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Authors can insert feedback as themselves.
DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.user_feedback;
CREATE POLICY "Users can insert their own feedback"
  ON public.user_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can read any feedback.
DROP POLICY IF EXISTS "Admins can read any feedback" ON public.user_feedback;
CREATE POLICY "Admins can read any feedback"
  ON public.user_feedback FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
