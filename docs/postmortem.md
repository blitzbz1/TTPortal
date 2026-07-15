# Postmortem: Supabase Realtime Egress Spike (Apr 28 – May 1, 2026)

## Summary

A four-day Realtime egress spike consumed ~5.4 GB on a project with **3–4 active users**, exceeding the 5 GB free-plan allocation by 1.22 GB. Realtime accounted for **99.8%** of total egress (Storage and PostgREST were negligible). The cause was the Supabase Realtime publication broadcasting per-row WAL events for every change to `public.notifications` — including the long tail of bulk operations and a server-side cleanup cron — to the only subscribed client (the in-app inbox). The realtime stream was redundant with the existing Expo push pipeline.

## Impact

- **Egress**: 6.22 GB billed for the period (5 GB free + 1.22 GB overage).
- **Daily peak**: 2.128 GB on Apr 29, 2.6 GB on Apr 30.
- **Users affected**: none directly — the inbox kept working — but the project went into overage.

## Timeline (UTC)

| Date | Realtime egress | Notable |
|---|---|---|
| Apr 27 | ~0 | Baseline |
| Apr 28 | ~300 MB | Spike begins |
| Apr 29 | 2.128 GB | v0.0.5-alpha shipped (release: f2c1c4e); spike peaks |
| Apr 30 | ~2.6 GB | Spike continues |
| May 1  | ~150 MB | Returns near baseline |
| May 2  | ~400 MB | Discovered, investigated, fix landed |

## Root cause

`public.notifications` was added to the `supabase_realtime` publication in migration `009_notification_triggers.sql:301`. The app subscribed to it from a single place — `src/contexts/NotificationProvider.tsx` via `src/hooks/useRealtime.ts` — with a per-user filter (`recipient_id=eq.${userId}`).

**The filter is correct, but Supabase Realtime billing meters bytes delivered to clients, and bulk operations on the table fan out one realtime event *per row* over the WebSocket.** Three pathways amplify this:

1. **`markAllAsRead(userId)`** (`src/services/notifications.ts:56`)  
   One SQL `UPDATE` touches every unread row for the user. Each updated row → one `UPDATE` event on the wire (~500 B–1 KB, including the new row payload). With a 100-row backlog this is ~50 KB per tap; with thousands it scales linearly.
2. **`deleteAllNotifications(userId)`** (`src/services/notifications.ts:49`)  
   Same shape, but for `DELETE` events. With `REPLICA IDENTITY` on the table, DELETE payloads include enough of the prior row to identify it.
3. **`cleanup_old_notifications()` cron** (`supabase/migrations/042_notifications_perf.sql:24`)  
   Runs hourly at `:30`. `DELETE FROM notifications WHERE created_at < now() - INTERVAL '30 days'`. Every deleted row produces a realtime DELETE delivered to whichever recipient is connected at that moment. The first run after a backfill — or a single sweep of an aged-out batch — explains a multi-GB burst.

Additionally, `trigger_event_cancelled_notification` (`supabase/migrations/009_notification_triggers.sql:188`) loops over every participant of a cancelled event and inserts a notification per participant. Combined with the `generate_recurring_events()` cron that auto-creates event instances hourly (`supabase/full_migration.sql:1461`), a single cancellation can fan out across many participants × many recurring instances.

The realtime stream itself was **redundant**: push notifications already fire from the database via `pg_net → Expo Push API` in `send_push_notification` (`supabase/migrations/009_notification_triggers.sql:13`). The app's `expo-notifications` listener (`src/contexts/NotificationProvider.tsx:271`) calls `refresh()` on every received push, so foregrounded users already get an updated inbox without the realtime channel.

## Fix landed

1. **Removed the realtime subscription** from `NotificationProvider`. The `useRealtime` import and call are gone; `src/hooks/useRealtime.ts` is deleted (no other consumers existed).
2. **Replaced live updates with an `AppState` foreground refresh** (`src/contexts/NotificationProvider.tsx:184-193`). Combined with the existing `Notifications.addNotificationReceivedListener` refresh and pull-to-refresh, foreground users still see fresh data on every meaningful trigger.
3. **Dropped `public.notifications` from the `supabase_realtime` publication** via `supabase/migrations/054_drop_notifications_from_realtime.sql`. This stops WAL events from being shipped to the realtime server entirely, so even bulk writes by the cleanup cron produce zero billable bytes.

After this lands the realtime egress for notifications becomes 0. Heartbeat / channel-join chatter on the WebSocket is also eliminated since the app no longer opens a channel.

## Verification queries

Run after deploy to confirm the publication change and inspect remaining notification activity:

```sql
-- 1. Confirm notifications is no longer published
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
-- Expect: notifications NOT in the result set.

-- 2. Hourly notification volume in the spike window (was the storm a single
--    burst or sustained chatter?)
SELECT date_trunc('hour', created_at) AS hour,
       count(*) AS inserted,
       count(*) FILTER (WHERE type='checkin_nearby')   AS checkins,
       count(*) FILTER (WHERE type='event_cancelled')  AS cancellations,
       count(*) FILTER (WHERE type='event_reminder')   AS reminders
FROM notifications
WHERE created_at >= '2026-04-27' AND created_at < '2026-05-02'
GROUP BY 1 ORDER BY 1;

-- 3. Backlog awaiting next cleanup run
SELECT count(*) AS total,
       count(*) FILTER (WHERE created_at < now() - interval '30 days')
         AS would_be_deleted
FROM notifications;
```

The Supabase Dashboard → **Logs → Realtime** filtered to the spike window will also corroborate the message rate (expect a steep drop after the publication change takes effect).

## Defense-in-depth follow-ups (landed in migration 055)

Beyond the publication drop, three structural protections ship with `055_notifications_egress_hardening.sql` so a future regression can't reproduce this:

1. **`REPLICA IDENTITY DEFAULT` on `notifications`** — explicit. If anyone ever puts the table back into a logical-decoding publication, DELETE/UPDATE events ship the primary key + new row only, not the full prior row. Halves per-event payload size as a worst-case bound.
2. **Bulk-INSERT refactor of fan-out triggers** — `trigger_event_cancelled_notification` and `trigger_checkin_notification` now use one `INSERT … SELECT` covering every recipient instead of a `FOR participant IN … LOOP create_and_send_notification()`. Same end state, single DML statement. Pushes still loop because `pg_net.http_post` is per-call, but pushes don't contribute to Realtime egress.
3. **Event-trigger guard** — `guard_notifications_publication` fires on `ALTER PUBLICATION` and aborts any DDL that re-adds `public.notifications` to `supabase_realtime`. The table policy is now machine-enforced; the only way past it is to drop the guard explicitly. Falls back to a `NOTICE` if the migration runs without privilege to create event triggers (some Supabase tiers); in that case the `COMMENT ON TABLE` and postmortem document the policy.

A `COMMENT ON TABLE public.notifications` also encodes the rule directly in the catalog so anyone running `\d notifications` sees the constraint without reading migrations.

### Still recommended (operational, not in this codebase)

- **Egress monitor.** Supabase doesn't surface a usage webhook on the free plan, so consider a daily scheduled agent that checks the project's usage page and alerts on > 5× day-over-day jumps in any egress category. Catches the *next* class of spike, regardless of source.

## What we learned

- **A correct subscription filter does not bound egress.** It bounds *which* clients receive each event, but every row change in a published table still produces an event. With one subscriber and one matched event per row, a bulk operation on a published table is functionally equivalent to a tight loop of individual events.
- **Adding a table to the realtime publication is a per-row throughput contract**, not a per-action one. Any code path that writes many rows in one statement — including server-side cron — must be considered.
- **Don't run a parallel push-pipeline + realtime pipeline for the same data.** Push already brings the user back; realtime was paying egress to deliver something the next `refresh()` would have fetched anyway.
- **For small user counts, the cheapest "live" UI is fetch-on-focus.** A 4-user inbox needs no streaming infrastructure.
