-- Migration: 100_admin_review_fn_backport (T021)
-- The 073/074 admin-review migrations had .sql/.txt twins: the chain ran
-- the .sql versions while prod ran the manually-applied .txt versions, so
-- a fresh replay diverged from prod for this function cluster. This
-- migration back-ports PROD'S LIVE DEFINITIONS (extracted 2026-06-11 via
-- pg_get_functiondef) so chain == prod by construction. The .txt twins are
-- deleted from the repo; 073/074.sql stay as applied history.


CREATE OR REPLACE FUNCTION public.admin_bulk_set_venue_review_state(p_venue_ids integer[], p_review_status text, p_approved boolean DEFAULT NULL::boolean, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(venue_id integer, review_status text, approved boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_city_review_queue(p_country_code text DEFAULT NULL::text, p_expansion_status text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_limit integer DEFAULT 80, p_offset integer DEFAULT 0)
 RETURNS TABLE(city_id integer, city_name text, country_code text, country_name text, admin_area text, local_area text, lat double precision, lng double precision, zoom integer, active boolean, expansion_status text, venue_count integer, approved_count integer, hidden_count integer, missing_address_count integer, missing_tables_count integer, unknown_condition_count integer, duplicate_name_groups integer, flagged_review_count integer, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH duplicate_names AS (
    SELECT v.city_id, COUNT(*)::INTEGER AS duplicate_name_groups
    FROM (
      SELECT venue_dupes.city_id, lower(trim(venue_dupes.name)) AS normalized_name
      FROM public.venues venue_dupes
      WHERE venue_dupes.city_id IS NOT NULL
      GROUP BY venue_dupes.city_id, lower(trim(venue_dupes.name))
      HAVING COUNT(*) > 1
    ) v
    GROUP BY v.city_id
  ),
  flagged_reviews AS (
    SELECT v.city_id, COUNT(r.id)::INTEGER AS flagged_review_count
    FROM public.reviews r
    JOIN public.venues v ON v.id = r.venue_id
    WHERE r.flagged = true
      AND v.city_id IS NOT NULL
    GROUP BY v.city_id
  )
  SELECT
    c.id AS city_id,
    c.name AS city_name,
    c.country_code,
    c.country_name,
    c.admin_area,
    c.local_area,
    c.lat,
    c.lng,
    c.zoom,
    c.active,
    c.expansion_status,
    COUNT(v.id)::INTEGER AS venue_count,
    COUNT(v.id) FILTER (WHERE v.approved = true)::INTEGER AS approved_count,
    COUNT(v.id) FILTER (WHERE v.approved = false)::INTEGER AS hidden_count,
    COUNT(v.id) FILTER (WHERE v.address IS NULL OR trim(v.address) = '')::INTEGER AS missing_address_count,
    COUNT(v.id) FILTER (WHERE v.tables_count IS NULL OR v.tables_count = 0)::INTEGER AS missing_tables_count,
    COUNT(v.id) FILTER (WHERE v.condition IS NULL OR v.condition = 'necunoscuta')::INTEGER AS unknown_condition_count,
    COALESCE(d.duplicate_name_groups, 0) AS duplicate_name_groups,
    COALESCE(fr.flagged_review_count, 0) AS flagged_review_count,
    c.updated_at
  FROM public.cities c
  LEFT JOIN public.venues v ON v.city_id = c.id
  LEFT JOIN duplicate_names d ON d.city_id = c.id
  LEFT JOIN flagged_reviews fr ON fr.city_id = c.id
  WHERE (p_country_code IS NULL OR c.country_code = p_country_code)
    AND (p_expansion_status IS NULL OR c.expansion_status = p_expansion_status)
    AND (
      p_query IS NULL
      OR trim(p_query) = ''
      OR unaccent(c.name) ILIKE '%' || unaccent(p_query) || '%'
      OR unaccent(COALESCE(c.admin_area, '')) ILIKE '%' || unaccent(p_query) || '%'
      OR unaccent(COALESCE(c.country_name, '')) ILIKE '%' || unaccent(p_query) || '%'
    )
  GROUP BY c.id, d.duplicate_name_groups, fr.flagged_review_count
  HAVING COUNT(v.id) > 0
  ORDER BY
    CASE WHEN c.expansion_status = 'community_review' THEN 0 ELSE 1 END,
    COUNT(v.id) DESC,
    c.country_name,
    c.name
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 80), 1), 250)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_venue_review_context(p_venue_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reviews JSONB;
  v_stats JSONB;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT to_jsonb(s)
  INTO v_stats
  FROM (
    SELECT venue_id, avg_rating, review_count, checkin_count, favorite_count
    FROM public.venue_stats
    WHERE venue_id = p_venue_id
  ) s;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.flagged DESC, r.created_at DESC), '[]'::jsonb)
  INTO v_reviews
  FROM (
    SELECT
      r.id,
      r.rating,
      r.body,
      r.flagged,
      r.flag_count,
      r.created_at,
      p.full_name
    FROM public.reviews r
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE r.venue_id = p_venue_id
    ORDER BY r.flagged DESC, r.created_at DESC
    LIMIT 8
  ) r;

  RETURN jsonb_build_object(
    'stats', v_stats,
    'reviews', v_reviews
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_venues_in_viewport(p_min_lat double precision, p_min_lng double precision, p_max_lat double precision, p_max_lng double precision, p_city_id integer DEFAULT NULL::integer, p_approved boolean DEFAULT NULL::boolean, p_type text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_needs_attention boolean DEFAULT false, p_limit integer DEFAULT 600)
 RETURNS TABLE(id integer, name text, city text, city_id integer, country_code text, address text, type text, tables_count integer, condition text, lat double precision, lng double precision, approved boolean, verified boolean, description text, review_status text, duplicate_of_venue_id integer, needs_manual_pin boolean, admin_review_notes text, reviewed_at timestamp with time zone, reviewed_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, avg_rating numeric, review_count integer, checkin_count integer, flagged_review_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    v.id,
    v.name,
    v.city,
    v.city_id,
    c.country_code,
    v.address,
    v.type,
    v.tables_count,
    v.condition,
    v.lat,
    v.lng,
    v.approved,
    v.verified,
    v.description,
    v.review_status,
    v.duplicate_of_venue_id,
    v.needs_manual_pin,
    v.admin_review_notes,
    v.reviewed_at,
    v.reviewed_by,
    v.created_at,
    v.updated_at,
    s.avg_rating,
    s.review_count,
    s.checkin_count,
    COUNT(r.id) FILTER (WHERE r.flagged = true)::INTEGER AS flagged_review_count
  FROM public.venues v
  LEFT JOIN public.cities c ON c.id = v.city_id
  LEFT JOIN public.venue_stats s ON s.venue_id = v.id
  LEFT JOIN public.reviews r ON r.venue_id = v.id
  WHERE v.lat BETWEEN LEAST(p_min_lat, p_max_lat) AND GREATEST(p_min_lat, p_max_lat)
    AND v.lng BETWEEN LEAST(p_min_lng, p_max_lng) AND GREATEST(p_min_lng, p_max_lng)
    AND (p_city_id IS NULL OR v.city_id = p_city_id)
    AND (p_approved IS NULL OR v.approved = p_approved)
    AND (p_type IS NULL OR v.type = p_type)
    AND (
      p_query IS NULL
      OR trim(p_query) = ''
      OR unaccent(v.name) ILIKE '%' || unaccent(p_query) || '%'
      OR unaccent(v.address) ILIKE '%' || unaccent(p_query) || '%'
    )
    AND (
      p_needs_attention = false
      OR v.address IS NULL
      OR trim(v.address) = ''
      OR v.tables_count IS NULL
      OR v.tables_count = 0
      OR v.condition IS NULL
      OR v.condition = 'necunoscuta'
      OR v.needs_manual_pin = true
      OR v.review_status IN ('needs_manual_pin', 'duplicate_candidate')
      OR EXISTS (
        SELECT 1
        FROM public.reviews attention_review
        WHERE attention_review.venue_id = v.id
          AND attention_review.flagged = true
      )
    )
  GROUP BY
    v.id,
    v.name,
    v.city,
    v.city_id,
    c.country_code,
    v.address,
    v.type,
    v.tables_count,
    v.condition,
    v.lat,
    v.lng,
    v.approved,
    v.verified,
    v.description,
    v.review_status,
    v.duplicate_of_venue_id,
    v.needs_manual_pin,
    v.admin_review_notes,
    v.reviewed_at,
    v.reviewed_by,
    v.created_at,
    v.updated_at,
    s.avg_rating,
    s.review_count,
    s.checkin_count
  ORDER BY
    COUNT(r.id) FILTER (WHERE r.flagged = true) DESC,
    v.approved ASC,
    v.updated_at DESC,
    v.name
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 600), 1), 1000);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_venue_review_state(p_venue_id integer, p_review_status text DEFAULT NULL::text, p_duplicate_of_venue_id integer DEFAULT NULL::integer, p_needs_manual_pin boolean DEFAULT NULL::boolean, p_notes text DEFAULT NULL::text, p_approved boolean DEFAULT NULL::boolean)
 RETURNS venues
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_city_review_status(p_city_id integer, p_active boolean, p_expansion_status text)
 RETURNS cities
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_city public.cities;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_expansion_status NOT IN (
    'active',
    'launch_ready',
    'community_review',
    'researching',
    'coming_soon',
    'hidden'
  ) THEN
    RAISE EXCEPTION 'Invalid expansion status';
  END IF;

  UPDATE public.cities
  SET active = p_active,
      expansion_status = p_expansion_status,
      updated_at = now()
  WHERE public.cities.id = p_city_id
  RETURNING * INTO v_city;

  IF v_city.id IS NULL THEN
    RAISE EXCEPTION 'City not found';
  END IF;

  RETURN v_city;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT p.is_admin
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ), false);
$function$;
