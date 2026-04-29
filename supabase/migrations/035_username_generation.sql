-- Migration: 035_username_generation
-- Auto-generate unique usernames from full_name + 4-char alphanumeric suffix.
-- Format: <first-name>-<xxxx>  e.g. "John Dow" -> "john-43ab".

-- Normalize a full_name into the username base: take the first whitespace-split
-- word, strip diacritics, lowercase, keep [a-z0-9] only. Falls back to 'user'.
CREATE OR REPLACE FUNCTION public.username_base_from_name(p_full_name TEXT)
RETURNS TEXT AS $$
DECLARE
  first_word TEXT;
  base TEXT;
BEGIN
  first_word := split_part(trim(coalesce(p_full_name, '')), ' ', 1);
  base := lower(translate(
    first_word,
    'ăâîșşțţĂÂÎȘŞȚŢáàäéèëíìïóòöúùüñçÁÀÄÉÈËÍÌÏÓÒÖÚÙÜÑÇ',
    'aaisstttAAISSTTaaaeeeiiiooouuuncAAAEEEIIIOOOUUUNC'
  ));
  base := regexp_replace(base, '[^a-z0-9]', '', 'g');
  IF base IS NULL OR length(base) = 0 THEN
    base := 'user';
  END IF;
  RETURN base;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate a unique username for a given full_name. Loops until the random
-- 4-char suffix produces a value not already in profiles.username.
CREATE OR REPLACE FUNCTION public.generate_username(p_full_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base TEXT;
  suffix TEXT;
  candidate TEXT;
  alphabet TEXT := '0123456789abcdefghijklmnopqrstuvwxyz';
  i INT;
  attempts INT := 0;
BEGIN
  base := public.username_base_from_name(p_full_name);
  LOOP
    suffix := '';
    FOR i IN 1..4 LOOP
      suffix := suffix || substr(alphabet, 1 + floor(random() * 36)::int, 1);
    END LOOP;
    candidate := base || '-' || suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate);
    attempts := attempts + 1;
    IF attempts > 25 THEN
      -- Astronomically unlikely; widen the namespace to guarantee progress.
      base := base || floor(random() * 1000)::text;
      attempts := 0;
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Replace the new-user trigger so it also assigns a username. Uses 'name' as
-- a fallback for OAuth providers (Google sets it on the IdToken).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  resolved_name TEXT;
BEGIN
  resolved_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    ''
  );
  INSERT INTO public.profiles (id, full_name, email, auth_provider, username)
  VALUES (
    NEW.id,
    resolved_name,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'auth_provider', 'email'),
    public.generate_username(resolved_name)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill any existing profiles missing a username.
UPDATE public.profiles
SET username = public.generate_username(full_name)
WHERE username IS NULL;
