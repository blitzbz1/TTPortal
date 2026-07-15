-- Optional verification after running 001 and 002.
-- Safe to run in Supabase SQL editor.

select
  public.recompute_badge_level(0) as level_0,
  public.recompute_badge_level(5) as level_5,
  public.recompute_badge_level(10) as level_10,
  public.recompute_badge_level(15) as level_15;

select category, count(*) as challenge_count
from public.challenges
group by category
order by category;

select
  count(*) filter (where title_key is null) as missing_title_keys,
  count(*) as total_challenges
from public.challenges;

select verification_type, count(*) as challenge_count
from public.challenges
group by verification_type
order by verification_type;

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('challenges', 'challenge_submissions')
  and indexname in (
    'challenges_category_legacy_code_uidx',
    'challenges_title_key_uidx',
    'challenge_submissions_one_approved_per_user_challenge_uidx'
  )
order by indexname;
