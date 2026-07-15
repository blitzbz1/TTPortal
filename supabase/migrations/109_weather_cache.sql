-- Migration: 109_weather_cache (F013)
-- Server-side cache for the weather-proxy edge function (Open-Meteo, keyless).
-- Mirrors 022_amatur_cache: id keyed by rounded "lat,lng", payload jsonb,
-- fetched_at. ~30-min TTL is enforced in the edge function on read.

CREATE TABLE IF NOT EXISTS public.weather_cache (
  id           text PRIMARY KEY,          -- "lat,lng" rounded to 2 decimals
  weather_data jsonb NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read weather cache" ON public.weather_cache;
CREATE POLICY "Anyone can read weather cache"
  ON public.weather_cache FOR SELECT
  USING (true);

-- NO write policy: the weather-proxy edge function uses the service role, which
-- bypasses RLS. A `FOR ALL USING(true) WITH CHECK(true)` policy (no TO clause)
-- would let any authenticated/anon client poison the cache — exactly the
-- cache-poisoning hole migration 089 removed from amatur_cache. Writes must
-- only ever come from the service role (or a future SECURITY DEFINER RPC).

-- Keep the table small — entries older than a day are useless (30-min TTL).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'prune_weather_cache';
    PERFORM cron.schedule(
      'prune_weather_cache',
      '37 3 * * *',  -- 03:37 daily
      $cron$DELETE FROM public.weather_cache WHERE fetched_at < now() - INTERVAL '1 day'$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron unavailable — prune weather_cache externally (daily).';
  END IF;
END $$;
