-- Migration: 098_trust_safety_groundwork (T089)
-- 1. Moderation audit trail: who did what, when — written by DB triggers
--    on the moderated state transitions (actor = auth.uid()), so it can't
--    be skipped by a client that "forgets" to log.
-- 2. UGC keyword/URL soft-flag: suspicious reviews auto-land in the
--    EXISTING flagged-reviews admin queue (never blocks the write).
-- Pre-requisite groundwork for DMs/Moments/Board (features roadmap).

-- ============================================================
-- 1. Audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moderation_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.moderation_audit_log IS
  'Immutable record of moderation actions (T089). Written by triggers; admin/moderator read-only.';

CREATE INDEX IF NOT EXISTS moderation_audit_log_target_idx
  ON public.moderation_audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS moderation_audit_log_created_idx
  ON public.moderation_audit_log (created_at DESC);

ALTER TABLE public.moderation_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit log readable by admins and moderators" ON public.moderation_audit_log;
CREATE POLICY "Audit log readable by admins and moderators"
  ON public.moderation_audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin OR is_moderator)
  ));
-- No INSERT/UPDATE/DELETE policies: only the SECURITY DEFINER triggers write.

CREATE OR REPLACE FUNCTION public.log_moderation_action(
  p_action TEXT, p_target_type TEXT, p_target_id TEXT, p_details JSONB DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.moderation_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_details);
EXCEPTION WHEN OTHERS THEN
  NULL; -- auditing must never break the moderated action itself
END;
$$;

-- Venue review-state transitions (approve/reject from the admin screen).
CREATE OR REPLACE FUNCTION public.audit_venue_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.approved IS DISTINCT FROM OLD.approved THEN
    PERFORM public.log_moderation_action(
      CASE WHEN NEW.approved THEN 'venue_approved' ELSE 'venue_unapproved' END,
      'venue', NEW.id::text,
      jsonb_build_object('name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_venue_moderation ON public.venues;
CREATE TRIGGER audit_venue_moderation
  AFTER UPDATE OF approved ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.audit_venue_moderation();

-- Review keep/delete from the flagged queue.
CREATE OR REPLACE FUNCTION public.audit_review_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Only audit deletions of flagged reviews (moderation), not user
    -- self-deletes of clean ones.
    IF OLD.flagged THEN
      PERFORM public.log_moderation_action('review_deleted', 'review', OLD.id::text,
        jsonb_build_object('venue_id', OLD.venue_id, 'author', OLD.user_id));
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.flagged AND NOT NEW.flagged THEN
    PERFORM public.log_moderation_action('review_kept', 'review', NEW.id::text,
      jsonb_build_object('venue_id', NEW.venue_id));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_review_moderation ON public.reviews;
CREATE TRIGGER audit_review_moderation
  AFTER UPDATE OF flagged OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.audit_review_moderation();

-- Report resolution.
CREATE OR REPLACE FUNCTION public.audit_report_resolution()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.resolved_at IS NULL AND NEW.resolved_at IS NOT NULL THEN
    PERFORM public.log_moderation_action('report_resolved', 'content_report', NEW.id::text,
      jsonb_build_object('content_type', NEW.content_type, 'content_id', NEW.content_id,
                         'resolution', NEW.resolution));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_report_resolution ON public.content_reports;
CREATE TRIGGER audit_report_resolution
  AFTER UPDATE OF resolved_at ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_report_resolution();

-- Moderator role grants/revocations (081's RPC updates profiles.is_moderator).
CREATE OR REPLACE FUNCTION public.audit_moderator_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_moderator IS DISTINCT FROM OLD.is_moderator THEN
    PERFORM public.log_moderation_action(
      CASE WHEN NEW.is_moderator THEN 'moderator_granted' ELSE 'moderator_revoked' END,
      'profile', NEW.id::text, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_moderator_change ON public.profiles;
CREATE TRIGGER audit_moderator_change
  AFTER UPDATE OF is_moderator ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_moderator_change();

-- ============================================================
-- 2. UGC keyword/URL soft-flag (reviews → existing flagged queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moderation_keywords (
  id      BIGSERIAL PRIMARY KEY,
  pattern TEXT NOT NULL UNIQUE,  -- case-insensitive regex fragment
  note    TEXT
);
ALTER TABLE public.moderation_keywords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Keywords readable by admins" ON public.moderation_keywords;
CREATE POLICY "Keywords readable by admins"
  ON public.moderation_keywords FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin));

-- Seed: URL spam patterns. Extend via the table — no migration needed.
INSERT INTO public.moderation_keywords (pattern, note) VALUES
  ('https?://', 'links in reviews are almost always spam'),
  ('www\.[a-z0-9-]+\.[a-z]{2,}', 'bare domains'),
  ('t\.me/', 'telegram spam'),
  ('wa\.me/', 'whatsapp spam')
ON CONFLICT (pattern) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ugc_suspicious(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pattern TEXT;
BEGIN
  IF p_text IS NULL OR length(p_text) = 0 THEN
    RETURN FALSE;
  END IF;
  FOR v_pattern IN SELECT pattern FROM public.moderation_keywords LOOP
    IF p_text ~* v_pattern THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  RETURN FALSE;
END;
$$;

-- Soft flag, never a block: the review saves normally and shows up in the
-- admin flagged queue with a marker note in the audit log.
CREATE OR REPLACE FUNCTION public.autoflag_suspicious_review()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.ugc_suspicious(NEW.body) THEN
    NEW.flagged := TRUE;
    NEW.flag_count := GREATEST(COALESCE(NEW.flag_count, 0), 1);
    PERFORM public.log_moderation_action('review_autoflagged', 'review',
      COALESCE(NEW.id::text, 'pending'), jsonb_build_object('venue_id', NEW.venue_id));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS autoflag_suspicious_review ON public.reviews;
CREATE TRIGGER autoflag_suspicious_review
  BEFORE INSERT OR UPDATE OF body ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.autoflag_suspicious_review();
