-- Admin replies to user_feedback entries.
-- On insert, notifies the feedback author via create_and_send_notification().

CREATE TABLE IF NOT EXISTS public.feedback_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.user_feedback(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reply_text TEXT NOT NULL CHECK (char_length(reply_text) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_replies_feedback_idx ON public.feedback_replies (feedback_id);
CREATE INDEX IF NOT EXISTS feedback_replies_created_at_idx ON public.feedback_replies (created_at DESC);

ALTER TABLE public.feedback_replies ENABLE ROW LEVEL SECURITY;

-- Admins can read all replies.
DROP POLICY IF EXISTS "Admins can read all feedback replies" ON public.feedback_replies;
CREATE POLICY "Admins can read all feedback replies"
  ON public.feedback_replies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Feedback authors can read replies to their own feedback.
DROP POLICY IF EXISTS "Feedback authors can read their replies" ON public.feedback_replies;
CREATE POLICY "Feedback authors can read their replies"
  ON public.feedback_replies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_feedback f
    WHERE f.id = feedback_replies.feedback_id AND f.user_id = auth.uid()
  ));

-- Only admins can insert replies.
DROP POLICY IF EXISTS "Admins can insert feedback replies" ON public.feedback_replies;
CREATE POLICY "Admins can insert feedback replies"
  ON public.feedback_replies FOR INSERT TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Extend notifications.type enum to include 'feedback_reply'.
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'event_invite', 'event_update',
    'event_feedback_request', 'event_feedback_received',
    'checkin_nearby',
    'review_on_venue',
    'feedback_reply'
  ));

-- Trigger: notify the feedback author when a reply is inserted.
CREATE OR REPLACE FUNCTION public.trigger_feedback_reply_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient UUID;
  preview TEXT;
BEGIN
  SELECT user_id INTO recipient FROM public.user_feedback WHERE id = NEW.feedback_id;

  IF recipient IS NULL THEN
    RETURN NEW;
  END IF;

  preview := CASE
    WHEN char_length(NEW.reply_text) > 140 THEN substring(NEW.reply_text FROM 1 FOR 140) || '…'
    ELSE NEW.reply_text
  END;

  PERFORM public.create_and_send_notification(
    recipient,
    NEW.admin_id,
    'feedback_reply',
    'Răspuns la feedback',
    preview,
    jsonb_build_object('feedbackId', NEW.feedback_id, 'replyId', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feedback_reply_notification ON public.feedback_replies;
CREATE TRIGGER trg_feedback_reply_notification
  AFTER INSERT ON public.feedback_replies
  FOR EACH ROW EXECUTE FUNCTION public.trigger_feedback_reply_notification();
