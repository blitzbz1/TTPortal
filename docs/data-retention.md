# Data retention policy (T082)

Decided 2026-06-11. Review yearly or when a feature changes what we store.

## Principles

- Data lives as long as the **account** lives; deleting the account deletes
  the data. We do not keep per-category time windows while an account is
  active, because every stored category serves a live product surface
  (check-in history powers Play History + leaderboards + badges; reviews and
  condition votes power venue quality; events power history/feedback).
- Anonymous/aggregate derivatives (venue stats, leaderboard snapshots) are
  not personal data once the source rows are gone.

## Per-category retention

| Category | While account active | After deletion request |
| --- | --- | --- |
| Profile | indefinite | soft-deleted immediately; hard-deleted after the 30-day grace (`hard_delete_expired_accounts` cron, migration 071) |
| Check-ins | indefinite — powers Play History, badges, leaderboards | deleted with the account |
| Reviews / condition votes | indefinite — venue quality signal | deleted with the account |
| Events + participation | indefinite — history & feedback | deleted with the account |
| Notifications | **90 days** (`cleanup_old_notifications` cron) | deleted with the account |
| Push tokens | until logout/uninstall (removed on sign-out) | deleted with the account |
| Moderation reports | indefinite (trust & safety legitimate interest) | reporter id detaches with the account |
| Action log (rate limiting) | **30 days** (`prune_action_log` cron) | n/a (already time-boxed) |
| Telemetry (crashes/analytics) | Loki retention per Grafana Cloud free-tier (~30 days); events carry **no PII** (client-side scrub + no user ids) | nothing to delete — events are not linkable to an account |

## User controls (mspec §11)

- **Download my data**: Settings → Privacy → "Download my data" → the
  `export-my-data` Edge Function returns every category above as JSON.
- **Analytics opt-out**: Settings → Privacy toggle; gates all product
  analytics client-side (crash reports remain — diagnostics, PII-scrubbed).
- **Delete account**: Settings → danger zone; 30-day grace, then hard
  delete (already shipped, migration 071).

## Justification for indefinite check-in retention

Check-ins are the product: streaks, badges (challenge progression scans
full history), the venue "champion" feature, and Play History all read
arbitrarily old rows. A time-boxed window would silently corrupt earned
badges and leaderboards. The compensating controls are the visibility
setting (friends/private, migration 091), the export, and full deletion
with the account.
