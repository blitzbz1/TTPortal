-- Migration: 080_venue_change_request_photo
-- Add an optional evidence photo to venue change requests, plus a per-user
-- daily cap on image uploads.
--
-- Design notes
-- ============
-- - photo_url holds the public URL of a user-attached image. The image is
--   resized on-device (lib/imageUpload) and uploaded to the existing
--   `venue-photos` Storage bucket under a `change-requests/<venueId>/` prefix,
--   mirroring how venue gallery photos are handled.
-- - Daily cap (10 images/user/day): Storage uploads have no DB trigger hook,
--   so we reuse the rate-limit framework (047) via a thin client-callable
--   RPC the app invokes BEFORE uploading. enforce_rate_limit gives us the
--   admin bypass, audit log, and runtime-tunable config for free.

alter table public.venue_change_requests
  add column if not exists photo_url text;

-- Daily image-upload cap. Tunable at runtime via rate_limit_config (no migration).
insert into public.rate_limit_config (action, scope, window_secs, max_attempts, description)
values ('upload_image', 'user', 86400, 10, '10 image uploads per 24 hours')
on conflict (action, scope, window_secs) do nothing;

-- Client-callable gate: enforce + record one image-upload attempt against the
-- per-user daily cap. Raises rate_limit_exceeded:user:upload_image:... when hit
-- (parsed client-side by lib/rateLimit). Call this right before uploading an
-- image to Storage.
create or replace function public.record_image_upload()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_rate_limit('upload_image');
end;
$$;

comment on function public.record_image_upload is
  'Enforce + record one image-upload attempt against the per-user daily cap (rate_limit_config action=upload_image). Call before uploading an image to Storage.';

grant execute on function public.record_image_upload() to authenticated;

-- Recreate submit_venue_change_request with the new p_photo_url parameter.
-- CREATE OR REPLACE can't add a parameter to an existing signature without
-- creating a second overload, so drop the original 6-arg version first.
drop function if exists public.submit_venue_change_request(integer, boolean, boolean, integer, boolean, text);

create or replace function public.submit_venue_change_request(
  p_venue_id          integer,
  p_nets              boolean default null,
  p_night_lighting    boolean default null,
  p_tables_count      integer default null,
  p_mark_unavailable  boolean default false,
  p_note              text    default null,
  p_photo_url         text    default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_nets is null and p_night_lighting is null and p_tables_count is null
     and coalesce(p_mark_unavailable, false) = false then
    raise exception 'empty_change_request' using errcode = 'P0001';
  end if;

  insert into public.venue_change_requests
    (venue_id, submitted_by, proposed_nets, proposed_night_lighting,
     proposed_tables_count, mark_unavailable, note, photo_url)
  values
    (p_venue_id, v_uid, p_nets, p_night_lighting, p_tables_count,
     coalesce(p_mark_unavailable, false), nullif(btrim(p_note), ''), nullif(btrim(p_photo_url), ''))
  on conflict (submitted_by, venue_id) do update
    set proposed_nets           = excluded.proposed_nets,
        proposed_night_lighting = excluded.proposed_night_lighting,
        proposed_tables_count   = excluded.proposed_tables_count,
        mark_unavailable        = excluded.mark_unavailable,
        note                    = excluded.note,
        photo_url               = excluded.photo_url,
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

comment on function public.submit_venue_change_request is
  'Submit/refresh a venue change request (incl. optional photo_url). Re-submitting for the same venue reopens the existing row instead of creating a duplicate.';

grant execute on function public.submit_venue_change_request(integer, boolean, boolean, integer, boolean, text, text) to authenticated;

NOTIFY pgrst, 'reload schema';
