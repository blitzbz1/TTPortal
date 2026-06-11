# Supabase Realtime: how it works, what it costs, and what to watch for in `gathering`

Companion to `postmortem.md` (the TTPortal Apr 28-30 spike) and the
2026-05-03 audit of `/Users/tavi/Projects/gathering/`.

---

## 1. How Supabase Realtime works

### 1.1 The pipeline

```
your SQL  ─►  Postgres WAL                  (every row change is logged)
          ─►  publication: supabase_realtime (filter: which tables forward downstream)
          ─►  logical decoding slot          (emits ONE event PER ROW, not per statement)
          ─►  Supabase Realtime server       (applies per-channel filters, fans out to clients)
          ─►  WebSocket  ─►  client          ◄── bytes are billed here
```

Every link is doing exactly its job. The pricing surprise comes from
the mismatch between how *developers* think about events ("the user
took an action") and how *Postgres* emits them ("a row changed").

### 1.2 The unit of billing

Supabase meters **bytes delivered to client sockets**. Two practical
implications:

- **Per-row, not per-statement.** A single
  `UPDATE notifications SET read = true WHERE recipient_id = $1`
  that touches 1,000 rows produces **1,000 separate WebSocket
  messages** — one per row, not one per `UPDATE`. There is no batched
  output mode in logical decoding.
- **Per subscribed client.** If five users are listening on a channel
  whose filter matches a given row event, that row is billed five
  times.

Total cost of a write:

```
bytes = rows_touched × bytes_per_event × matching_subscribers
```

Typical `bytes_per_event` is **~500 B – 1 KB** (JSON envelope:
schema, table name, commit timestamp, old/new records, columns
metadata). With `REPLICA IDENTITY FULL` on the table (Supabase's
default for some tables), DELETE/UPDATE events ship most of the
prior row too — roughly doubling the number. With
`REPLICA IDENTITY DEFAULT` (or `USING INDEX <pk>`), DELETEs ship
the primary key only (~200 B).

### 1.3 Why a "correct" channel filter does not bound egress

Channel filters like `event_id=eq.<id>` look like they protect you,
and they do — but only on the *delivery* side. The filter decides
*which clients* receive a given row event. The event itself was
already produced upstream when the row changed. So:

- **5 subscribers on the same channel × 1 bulk delete of 1,000 rows
  = 5,000 delivered events.** The filter didn't reduce production;
  it just selected an audience.
- A filter that matches *all* rows for a given user (e.g.
  `recipient_id=eq.<user>` on an inbox) is essentially `count(*) = N`
  for any bulk operation that user triggers.

The only ways to truly reduce egress are: (a) write fewer rows, (b)
have fewer subscribers connected at the moment of the write, or (c)
take the table out of the publication.

### 1.4 Common amplifiers

Things that turn one user-meaningful action into many billed events:

| Pattern | Amplification |
|---|---|
| Bulk UPDATE / DELETE (`markAllAsRead`, `deleteAll`, etc.) | 1 statement → N events where N = rows touched |
| `pg_cron` cleanup of aged-out rows on a published table | 1 cron firing → potentially thousands of events to whoever's connected |
| Cascade DELETE on parent → published children | 1 user delete → fan-out across N child rows × M child tables |
| Trigger that loops `INSERT`-per-recipient | 1 source event → N inserts → N row-level events |
| `REPLICA IDENTITY FULL` on a wide table | Doubles per-event payload (~1 KB → ~2 KB per UPDATE/DELETE) |
| Multiple subscribers on the same channel | Per-subscriber multiplier on every event |

---

## 2. `gathering` audit: where Realtime is in use

### 2.1 Tables in the `supabase_realtime` publication (13)

From migrations `021_enable_realtime.sql`, `056_notification_history.sql`,
and `090_realtime_purchase_item_buyers.sql`:

```
purchase_items, purchase_item_consumers, purchase_item_buyers,
expenses, expense_items,
participants, invitations,
events, sub_events, activities,
bring_items, settlements,
notification_history
```

### 2.2 Active client subscriptions (4 hooks)

| Hook | Table(s) subscribed | Filter scope (typical) |
|---|---|---|
| `src/hooks/useBringList.ts` | `bring_items` | per `event_id` |
| `src/hooks/useParticipants.ts` | `participants` | per `event_id` |
| `src/hooks/usePurchaseList.ts` | `purchase_items` (+ buyers) | per `event_id` |
| `src/hooks/useNotificationHistory.ts` | `notification_history` | per `recipient_id` |

The first three are **load-bearing for the product** — collaborative
shopping/expense splitting requires every participant of an event to
see lists update live. The fourth is the same archetype as TTPortal's
deleted notifications subscription and warrants the same scrutiny.

### 2.3 Risks identified

| # | Risk | Where | Why it matters |
|---|---|---|---|
| 1 | **Cascade delete on `events`** | `event.service.ts:110, 329` | Deleting an event cascades into ~11 published child tables. One delete on a busy event → row events for every purchase item, expense, participant, etc., delivered to every still-connected subscriber. |
| 2 | **Cascade delete on `participants`** | `participant.service.ts:1384` (cleanup of "claims and expenses") | Removing a participant from a busy event fans out across `purchase_item_consumers`, `expense_items`, `bring_item_claimers`. All three are published. |
| 3 | **Cascade delete on `sub_events`** | `subevent.service.ts:441, 492` | Same shape, smaller blast radius. |
| 4 | **`.in(...)` batch updates / deletes** | `settlement.service.ts`, `expense.service.ts`, `participant.service.ts` | Each touched row → one realtime event per subscriber. |
| 5 | **Four `pg_cron` jobs** | `022, 071, 100, 103` | If any periodically `DELETE FROM <published_table>` (likely in `071_analytics_scheduled_jobs.sql`), that's the exact shape of TTPortal's hourly cleanup that produced 2 GB single-day bursts. **Audit this first.** |
| 6 | **`notification_history` published** | `056_notification_history.sql:166` | If there's a `markAllAsRead` or bulk archive operation on it, it's TTPortal's notifications table redux. |
| 7 | **No `REPLICA IDENTITY DEFAULT` pinning** | All 13 published tables | If any table inherits `REPLICA IDENTITY FULL`, every UPDATE/DELETE event ships ~2× the bytes. |
| 8 | **No publication guard** | DDL | Anyone with Studio access can `ALTER PUBLICATION supabase_realtime ADD TABLE …` and silently introduce a new high-volume publisher. |

---

## 3. Cost model

Numbers are **estimates**. Real values vary by row width, REPLICA
IDENTITY mode, and connection patterns. Treat them as order-of-
magnitude planning numbers, not invoices.

### 3.1 Cost primitives

| Primitive | Estimate |
|---|---|
| Per-row event payload | **~600 B** (small row) to **~2 KB** (wide row with `REPLICA IDENTITY FULL` on UPDATE/DELETE) |
| Supabase Free egress allowance | 5 GB / month |
| Supabase Pro egress included | 250 GB / month |
| Pro overage rate | $0.09 / GB |

### 3.2 Per-operation egress (gathering shapes)

`N` = number of subscribers currently connected to the affected
event's channels. Most numbers below assume `~600 B/event`.

| Operation | Rows touched | Egress | Notes |
|---|---|---|---|
| Add one item to a purchase list | 1 INSERT | `0.6 KB × N` | Trivial. |
| Mark one item bought (UPDATE) | 1 UPDATE | `0.6 KB × N` | Trivial. |
| Settle one expense | 1 UPDATE on `settlements` + cascading updates | `~2 KB × N` | Single user action, modest. |
| Add a participant to an event | 1 INSERT | `0.6 KB × N` | Trivial. |
| **Remove a participant** (cascade) | M claims + K expense_items + J bring claimers | `(M+K+J) × 0.6 KB × N` | Scales with the participant's footprint. For a power user on a busy event (M=20, K=15, J=5): ~24 KB × N. |
| **Delete a sub-event** | All items/expenses for that sub-event | `(items+expenses) × 0.6 KB × N` | For a 50-item sub-event with 10 participants: ~300 KB. |
| **Delete an event** | Full cascade across 11 child tables | `total_child_rows × 0.6 KB × N` | A busy event with 200 children and 20 connected: ~2.4 MB per delete. |
| `notification_history` `markAllAsRead`-style bulk update | unread_count rows | `unread × 0.6 KB × 1` (only the recipient subscribes) | TTPortal pattern. 100 unread → 60 KB; 1000 unread → 600 KB per tap. |
| **`pg_cron` cleanup deleting `K` rows on a published table** | K | `K × 0.6 KB × N_connected` | The classic burst. K=10,000 with N=5: **30 MB per cron run**. Hourly: 720 MB/day = **21 GB/month**. |

### 3.3 How cost grows with user count

The interesting variable is not "users in the system" — it's
**concurrent subscribers per channel** at the moment a write happens.
Three distinct dimensions:

```
events_per_op       = rows_touched_by_op
subscribers_per_op  = connected_clients_to_matching_channel
ops_per_day         = ops_per_user_per_day × active_users
```

Daily egress:

```
egress/day = ops_per_day × events_per_op × subscribers_per_op × bytes_per_event
```

#### Worked scenarios

Assume `bytes_per_event = 600 B`, `subscribers_per_event = avg(N)`,
and treat events as independent islands.

**Scenario A — small social user base, healthy use**
- 1,000 active users, 100 events/day created
- Avg 5 participants per event, ~3 typically connected at once
- ~50 list ops per event lifetime (adds + buys + settle)
- Egress = 100 × 50 × 3 × 600 B = **9 MB/day** = ~270 MB/month
- **Verdict: well inside Free tier.**

**Scenario B — popular product, many concurrent**
- 10,000 active users, 500 events/day created
- Avg 12 participants per event, ~8 typically connected
- ~150 ops per event lifetime
- Egress = 500 × 150 × 8 × 600 B = **360 MB/day** = ~10.8 GB/month
- **Verdict: comfortably within Pro's 250 GB.**

**Scenario C — Scenario B + one bad cron**
- Same as B, plus a `pg_cron` job that nightly deletes archived rows
  from a published table. Per run: 50,000 rows × 5 connected × 600 B = **150 MB/run**
- 1 run/day = **+4.5 GB/month**, still fine
- **Misconfigured to run hourly: +110 GB/month** — eats roughly half
  the Pro allotment from one job
- **Verdict: a single misconfigured cron can dominate the bill.**

**Scenario D — TTPortal-style runaway**
- A published table (notifications) with a hourly cleanup that sweeps
  ~10,000 rows at a time, while one user has the inbox open.
  Per run: 10,000 × 1 × 600 B = 6 MB/run
- An app-side `markAllAsRead` triggered ~10×/day per user with 100
  unread average: 100 × 600 B × 10 = 600 KB/user/day
- For 5 active inbox-open users: **~30 MB/day**, plus the cron storm
  → multi-GB single-day bursts when the cleanup hits a backlog
- **Verdict: this is what produced the Apr 28-30 spike (2-2.6 GB/day).**

#### The dangerous scaling shape

The pricing equation has **three multiplicative terms**, so a 10×
increase in any one of them cascades. Going from 5 → 50 active
subscribers per event AND from 100 → 1,000 events/day AND from 50
→ 200 ops/event = 400× egress. Realtime budgets that work at
launch can become very wrong at PMF.

The tightest ceiling is **subscribers × rows-per-bulk-op**: any
operation that multiplies these two terms (cron cleanup with users
connected, mass cascade with many subscribers) is the structural
risk.

---

## 4. Recommended mitigations for `gathering`

Ranked by impact / effort.

### 4.1 Audit the four `pg_cron` jobs (highest priority, lowest effort)

Files: `022_setup_pg_cron_schedule.sql`, `071_analytics_scheduled_jobs.sql`, `100_event_overview_email_cron.sql`, `103_rate_limit.sql`.

For each job, answer:

1. Does it `DELETE` or `UPDATE` from any of the 13 published tables?
2. How many rows per typical run? Per worst-case run (e.g., first
   run after a backfill)?
3. If yes to both: can the cleanup target a non-published mirror, or
   chunk into batches with `pg_sleep` between, or be rewritten to
   `TRUNCATE` a partition (DDL, not DML — does not produce row
   events)?

`071_analytics_*` is the prime suspect since analytics jobs
typically aggregate-and-purge windows.

### 4.2 Pin `REPLICA IDENTITY DEFAULT` on every published table

Single migration, idempotent, halves the worst-case payload of
UPDATE/DELETE events.

```sql
ALTER TABLE public.purchase_items REPLICA IDENTITY DEFAULT;
ALTER TABLE public.purchase_item_consumers REPLICA IDENTITY DEFAULT;
-- ... and the other 11
```

### 4.3 Bulk-rewrite any per-recipient `LOOP` triggers

Same change `055_notifications_egress_hardening.sql` applied to
TTPortal's `trigger_event_cancelled_notification` and
`trigger_checkin_notification`: replace `FOR rec IN ... LOOP INSERT
...` with a single `INSERT ... SELECT ... FROM <recipients>`. One
DML statement → one logical decoding pass → still N row events, but
fewer trigger-execution costs and cleaner WAL.

### 4.4 Add a publication guard

Same pattern as TTPortal's `055`/`056`: an event trigger on
`ALTER PUBLICATION` that aborts any addition to `supabase_realtime`
not on an explicit allow-list. Allow-list is the 13 tables above;
adding a 14th requires explicitly extending the allow-list, which
forces a code review.

### 4.5 Audit `notification_history` for bulk patterns

Search for `markAllAsRead`, `archive`, `clear`, or any service-layer
call that ends in `.delete().in(...)` or `.update(...).in(...)` on
this table. If found, either:

- Remove `notification_history` from the publication and rely on a
  push-pipeline + foreground refresh (TTPortal's exact fix), or
- Refactor the bulk operation to update one row per call (slower but
  bounded).

### 4.6 Egress monitor

Daily scheduled agent that reads the project's usage page (or hits
the Management API) and alerts on a >5× day-over-day jump in any
egress category. Catches the next class of spike regardless of
source. Cheap to run, has paid for itself the moment it fires once.

### 4.7 Per-event channel scoping (verify, don't add if already there)

Confirm every subscription filters by `event_id=eq.<id>` (or
`recipient_id=eq.<user>` for the inbox). A channel filter that
matches all rows in a published table multiplies subscribers ×
all-app activity, not subscribers × this-event activity.

---

## 5. TL;DR

- Supabase Realtime is **per-row, per-subscriber billed**. Channel
  filters limit *audience*, not *production*.
- `gathering` legitimately needs Realtime — collaborative live
  editing — but has the same amplifiers (bulk ops, cascade deletes,
  pg_cron, fan-out triggers) that produced TTPortal's spike, on a
  larger surface (13 published tables vs. TTPortal's 1).
- Day-to-day egress for a healthy user base is **modest** (single-
  digit GB/month). The risk is **structural bursts** from cron jobs
  or mass cascade deletes on published tables.
- The cheapest insurance is: (a) audit the four `pg_cron` jobs, (b)
  pin `REPLICA IDENTITY DEFAULT`, (c) install a publication guard,
  (d) wire an egress monitor.
