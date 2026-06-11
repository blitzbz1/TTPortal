# Challenge system SQL — historical copies

These files were applied to prod **manually**, outside the migration chain
(before migration 025/026 came to depend on them), so the schema exists in
prod but not in migration history.

As of T020 (reworked under the history-immutability rule — migrations
000–081 are applied on prod and frozen), the canonical tracked copy is
[`../migrations/094_challenge_system.sql`](../migrations/094_challenge_system.sql):
001 + 002 + 004 folded as a NEW migration, idempotent against prod (the
seed is `ON CONFLICT DO NOTHING` there so it can't revert 079's title
rewording).

Do not edit the files here — add a new migration instead.
`003_challenge_smoke_checks.sql` is a manual diagnostic script, not schema.
