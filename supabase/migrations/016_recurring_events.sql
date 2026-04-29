-- Migration: 016_recurring_events
-- Add recurrence support to events: columns, cron function for auto-generation.

-- 1. New columns on events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT
    CHECK (recurrence_rule IN ('daily', 'weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS recurrence_day INT,
  ADD COLUMN IF NOT EXISTS parent_event_id INT REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_recurrence ON public.events(recurrence_rule)
  WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_parent ON public.events(parent_event_id)
  WHERE parent_event_id IS NOT NULL;

-- 2. Cron function: generate next instance for each recurring series
CREATE OR REPLACE FUNCTION public.generate_recurring_events()
RETURNS void AS $$
DECLARE
  rec RECORD;
  next_start TIMESTAMPTZ;
  next_end TIMESTAMPTZ;
  duration INTERVAL;
  root_id INT;
  new_event_id INT;
BEGIN
  FOR rec IN
    WITH latest_per_series AS (
      SELECT DISTINCT ON (COALESCE(parent_event_id, id))
        *
      FROM public.events
      WHERE recurrence_rule IS NOT NULL
        AND status NOT IN ('cancelled')
      ORDER BY COALESCE(parent_event_id, id), starts_at DESC
    )
    SELECT * FROM latest_per_series
    WHERE starts_at < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.events e2
        WHERE e2.starts_at > NOW()
          AND e2.status != 'cancelled'
          AND (
            e2.parent_event_id = COALESCE(latest_per_series.parent_event_id, latest_per_series.id)
            OR (e2.id = COALESCE(latest_per_series.parent_event_id, latest_per_series.id)
                AND e2.recurrence_rule IS NOT NULL)
          )
      )
  LOOP
    duration := COALESCE(rec.ends_at - rec.starts_at, INTERVAL '0');
    root_id := COALESCE(rec.parent_event_id, rec.id);

    -- Advance starts_at until it is in the future
    next_start := rec.starts_at;
    LOOP
      CASE rec.recurrence_rule
        WHEN 'daily'   THEN next_start := next_start + INTERVAL '1 day';
        WHEN 'weekly'  THEN next_start := next_start + INTERVAL '7 days';
        WHEN 'monthly' THEN next_start := next_start + INTERVAL '1 month';
      END CASE;
      EXIT WHEN next_start > NOW();
    END LOOP;

    next_end := CASE
      WHEN rec.ends_at IS NOT NULL THEN next_start + duration
      ELSE NULL
    END;

    INSERT INTO public.events (
      title, description, venue_id, table_number, organizer_id,
      starts_at, ends_at, max_participants, status, event_type,
      recurrence_rule, recurrence_day, parent_event_id
    ) VALUES (
      rec.title, rec.description, rec.venue_id, rec.table_number, rec.organizer_id,
      next_start, next_end, rec.max_participants, 'open', rec.event_type,
      rec.recurrence_rule, rec.recurrence_day, root_id
    )
    RETURNING id INTO new_event_id;

    -- Auto-join the organizer
    INSERT INTO public.event_participants (event_id, user_id)
    VALUES (new_event_id, rec.organizer_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule with pg_cron (hourly at :15, offset from reminders at :00)
DO $$
BEGIN
  PERFORM cron.schedule(
    'generate-recurring-events',
    '15 * * * *',
    'SELECT public.generate_recurring_events()'
  );
  RAISE NOTICE 'Scheduled recurring events cron job';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule cron -- pg_cron not available';
END $$;
