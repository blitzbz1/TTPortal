-- Migration: 108_venue_amenities (F012)
-- Structured amenities / fees / access on venues, editable through the EXISTING
-- venue change-request moderation queue (078/080) — no new review surface.
--
-- amenities jsonb vocabulary (all optional; absent key = "unknown"):
--   rental, ball_vending, showers_lockers, parking, wheelchair, cafe_water,
--   byo_net : boolean
--   entry_fee : 'free' | 'day_pass' | 'membership'
--
-- Reads: get_venue_amenities (detail, merged client-side like 104/106/107) and
-- get_city_venue_amenities (map filter chips). Both anon-readable, counts/flags
-- only. Edits flow through submit_venue_change_request (now carrying
-- proposed_amenities) and are applied by resolve_venue_change_request.

-- 1. Columns ---------------------------------------------------------------
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS amenities jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.venues.amenities IS
  'Structured amenities/fees (F012): {rental,ball_vending,showers_lockers,parking,'
  'wheelchair,cafe_water,byo_net:bool, entry_fee:free|day_pass|membership}. Absent = unknown.';

ALTER TABLE public.venue_change_requests
  ADD COLUMN IF NOT EXISTS proposed_amenities jsonb;

-- A request must still propose at least one change — now amenities count too.
ALTER TABLE public.venue_change_requests
  DROP CONSTRAINT IF EXISTS venue_change_requests_has_change_chk;
ALTER TABLE public.venue_change_requests
  ADD CONSTRAINT venue_change_requests_has_change_chk
  CHECK (proposed_nets IS NOT NULL
         OR proposed_night_lighting IS NOT NULL
         OR proposed_tables_count IS NOT NULL
         OR (proposed_amenities IS NOT NULL AND proposed_amenities <> '{}'::jsonb)
         OR mark_unavailable = true);

-- 2. Read RPCs -------------------------------------------------------------
-- Venue-detail amenities (merged into the bundle by useVenueDetailQuery).
CREATE OR REPLACE FUNCTION public.get_venue_amenities(p_venue_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(v.amenities, '{}'::jsonb) FROM public.venues v WHERE v.id = p_venue_id;
$$;

REVOKE ALL ON FUNCTION public.get_venue_amenities(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_amenities(integer) TO authenticated, anon;

-- Per-city amenities for the map filter chips (only venues that have any set).
CREATE OR REPLACE FUNCTION public.get_city_venue_amenities(p_city_id integer)
RETURNS TABLE (venue_id integer, amenities jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT v.id, v.amenities
  FROM public.venues v
  WHERE (p_city_id IS NULL OR v.city_id = p_city_id)
    AND v.amenities IS NOT NULL
    AND v.amenities <> '{}'::jsonb;
$$;

REVOKE ALL ON FUNCTION public.get_city_venue_amenities(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_city_venue_amenities(integer) TO authenticated, anon;

-- 3. Submit RPC — recreate adding p_amenities (the 080 drop+recreate pattern) -
DROP FUNCTION IF EXISTS public.submit_venue_change_request(integer, boolean, boolean, integer, boolean, text, text);

CREATE OR REPLACE FUNCTION public.submit_venue_change_request(
  p_venue_id          integer,
  p_nets              boolean default null,
  p_night_lighting    boolean default null,
  p_tables_count      integer default null,
  p_mark_unavailable  boolean default false,
  p_note              text    default null,
  p_photo_url         text    default null,
  p_amenities         jsonb   default null
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_uid uuid := auth.uid();
  v_id  bigint;
  v_amenities jsonb := nullif(p_amenities, '{}'::jsonb);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_nets is null and p_night_lighting is null and p_tables_count is null
     and v_amenities is null
     and coalesce(p_mark_unavailable, false) = false then
    raise exception 'empty_change_request' using errcode = 'P0001';
  end if;

  insert into public.venue_change_requests
    (venue_id, submitted_by, proposed_nets, proposed_night_lighting,
     proposed_tables_count, mark_unavailable, note, photo_url, proposed_amenities)
  values
    (p_venue_id, v_uid, p_nets, p_night_lighting, p_tables_count,
     coalesce(p_mark_unavailable, false), nullif(btrim(p_note), ''), nullif(btrim(p_photo_url), ''),
     v_amenities)
  on conflict (submitted_by, venue_id) do update
    set proposed_nets           = excluded.proposed_nets,
        proposed_night_lighting = excluded.proposed_night_lighting,
        proposed_tables_count   = excluded.proposed_tables_count,
        mark_unavailable        = excluded.mark_unavailable,
        note                    = excluded.note,
        photo_url               = excluded.photo_url,
        proposed_amenities      = excluded.proposed_amenities,
        status                  = 'pending',
        resolution              = null,
        reviewed_by             = null,
        reviewed_at             = null,
        created_at              = now(),
        updated_at              = now()
  returning id into v_id;

  return v_id;
end;
$$;

COMMENT ON FUNCTION public.submit_venue_change_request(integer, boolean, boolean, integer, boolean, text, text, jsonb) IS
  'Submit/refresh a venue change request (incl. proposed_amenities, F012). Re-submitting for the same venue reopens the existing row.';

GRANT EXECUTE ON FUNCTION public.submit_venue_change_request(integer, boolean, boolean, integer, boolean, text, text, jsonb) TO authenticated;

-- 4. Resolve RPC — recreate adding p_apply_amenities ------------------------
DROP FUNCTION IF EXISTS public.resolve_venue_change_request(bigint, boolean, boolean, boolean, text);

CREATE OR REPLACE FUNCTION public.resolve_venue_change_request(
  p_request_id           bigint,
  p_apply_nets           boolean default false,
  p_apply_night_lighting boolean default false,
  p_apply_tables_count   boolean default false,
  p_availability         text    default 'none',
  p_apply_amenities      boolean default false
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_req         public.venue_change_requests;
  v_venue       public.venues;
  v_before      jsonb;
  v_avail       text := coalesce(p_availability, 'none');
  v_do_nets     boolean;
  v_do_light    boolean;
  v_do_tables   boolean;
  v_do_amenity  boolean;
  v_applied     int := 0;
  v_proposed    int := 0;
  v_status      text;
  v_resolution  jsonb := jsonb_build_object();
begin
  if not public.is_current_user_admin() then
    raise exception 'Unauthorized';
  end if;

  if v_avail not in ('none', 'hide', 'remove') then
    raise exception 'Invalid availability action: %', v_avail;
  end if;

  select * into v_req from public.venue_change_requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Change request not found: %', p_request_id;
  end if;

  select * into v_venue from public.venues where id = v_req.venue_id;
  if v_venue.id is null then
    update public.venue_change_requests
       set status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now(),
           resolution = jsonb_build_object('venue_missing', true)
     where id = p_request_id;
    return 'dismissed';
  end if;

  v_before := to_jsonb(v_venue);

  v_do_nets    := p_apply_nets           and v_req.proposed_nets is not null;
  v_do_light   := p_apply_night_lighting and v_req.proposed_night_lighting is not null;
  v_do_tables  := p_apply_tables_count   and v_req.proposed_tables_count is not null;
  v_do_amenity := p_apply_amenities      and v_req.proposed_amenities is not null
                                          and v_req.proposed_amenities <> '{}'::jsonb;

  if v_req.proposed_nets is not null then
    v_proposed := v_proposed + 1;
    v_resolution := v_resolution || jsonb_build_object('nets', case when v_do_nets then 'accepted' else 'rejected' end);
  end if;
  if v_req.proposed_night_lighting is not null then
    v_proposed := v_proposed + 1;
    v_resolution := v_resolution || jsonb_build_object('night_lighting', case when v_do_light then 'accepted' else 'rejected' end);
  end if;
  if v_req.proposed_tables_count is not null then
    v_proposed := v_proposed + 1;
    v_resolution := v_resolution || jsonb_build_object('tables_count', case when v_do_tables then 'accepted' else 'rejected' end);
  end if;
  if v_req.proposed_amenities is not null and v_req.proposed_amenities <> '{}'::jsonb then
    v_proposed := v_proposed + 1;
    v_resolution := v_resolution || jsonb_build_object('amenities', case when v_do_amenity then 'accepted' else 'rejected' end);
  end if;
  if v_req.mark_unavailable then
    v_proposed := v_proposed + 1;
    v_resolution := v_resolution || jsonb_build_object('availability', v_avail);
  end if;

  -- Apply accepted attribute edits in one UPDATE. Amenities MERGE into the
  -- existing jsonb (|| overwrites only the proposed keys) so unrelated, already
  -- known amenities are preserved.
  if v_do_nets or v_do_light or v_do_tables or v_do_amenity then
    update public.venues
       set nets           = case when v_do_nets    then v_req.proposed_nets           else nets end,
           night_lighting = case when v_do_light   then v_req.proposed_night_lighting else night_lighting end,
           tables_count   = case when v_do_tables  then v_req.proposed_tables_count   else tables_count end,
           amenities      = case when v_do_amenity then coalesce(amenities, '{}'::jsonb) || v_req.proposed_amenities else amenities end
     where id = v_req.venue_id;
    v_applied := v_applied
      + (case when v_do_nets then 1 else 0 end)
      + (case when v_do_light then 1 else 0 end)
      + (case when v_do_tables then 1 else 0 end)
      + (case when v_do_amenity then 1 else 0 end);
  end if;

  if v_avail = 'remove' then
    delete from public.venues where id = v_req.venue_id;
    return 'applied';
  elsif v_avail = 'hide' then
    update public.venues
       set approved = false, review_status = 'hidden',
           reviewed_at = now(), reviewed_by = auth.uid()
     where id = v_req.venue_id;
    v_applied := v_applied + 1;
  end if;

  if v_applied = 0 then
    v_status := 'dismissed';
  elsif v_applied >= v_proposed then
    v_status := 'applied';
  else
    v_status := 'partially_applied';
  end if;

  update public.venue_change_requests
     set status = v_status, resolution = v_resolution,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_request_id;

  insert into public.venue_admin_audit(venue_id, admin_id, action, before_state, after_state, note)
  values (
    v_req.venue_id, auth.uid(), 'change_request_' || v_status, v_before,
    (select to_jsonb(v2) from public.venues v2 where v2.id = v_req.venue_id), v_req.note
  );

  return v_status;
end;
$$;

COMMENT ON FUNCTION public.resolve_venue_change_request(bigint, boolean, boolean, boolean, text, boolean) IS
  'Admin-only: apply accepted fields (incl. amenities, F012) from a venue change request, optionally hide/remove, record the decision, audit.';

GRANT EXECUTE ON FUNCTION public.resolve_venue_change_request(bigint, boolean, boolean, boolean, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
