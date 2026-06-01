-- Allow admins to delete user feedback (moderation).

DROP POLICY IF EXISTS "Admins can delete any feedback" ON public.user_feedback;
CREATE POLICY "Admins can delete any feedback"
  ON public.user_feedback FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
