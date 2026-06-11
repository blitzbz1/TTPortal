# Supabase CLI (Windows)

Guide for installing the Supabase CLI on Windows, linking it to a cloud project, pushing migrations, and the security considerations when an AI agent has access to it.

All commands below assume **PowerShell** (Windows PowerShell 5.1 or PowerShell 7+). Where a command differs in `cmd.exe`, the alternative is noted.

## 1. Installation

The CLI is distributed as a standalone binary. Do **not** install it globally via `npm i -g supabase` — that path is unsupported.

### 1.1 Scoop (recommended)

Install Scoop first from https://scoop.sh if you don't have it. In PowerShell:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

Then add the Supabase bucket and install:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
# upgrade later with:
scoop update supabase
```

### 1.2 Winget

Not officially supported. If `winget` surfaces a `supabase` package, verify the publisher before installing — the canonical distributions are the Scoop bucket above or the GitHub release binaries below.

### 1.3 Direct binary

Download `supabase_windows_amd64.tar.gz` (or `_arm64`) from https://github.com/supabase/cli/releases, extract `supabase.exe`, and place it on `PATH` (e.g. `%USERPROFILE%\bin`).

Extract from PowerShell:

```powershell
tar -xzf supabase_windows_amd64.tar.gz -C $env:USERPROFILE\bin
```

Add the folder to `PATH` for the current user:

```powershell
[Environment]::SetEnvironmentVariable(
  "Path",
  [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\bin",
  "User"
)
```

Close and reopen the shell after editing `PATH`.

### 1.4 npm (dev dependency, per-repo)

```powershell
npm i -D supabase
npx supabase --version
```

Pins the version per repo and works on any Node-supported Windows setup.

### 1.5 WSL 2 note

If you work inside WSL, install the Linux build there instead (Homebrew on Linux, or `_linux_amd64` from the releases page). The Windows and WSL binaries are independent — pick one and stick with it so `supabase link` writes its state to a single `supabase\.temp\` location.

### 1.6 Docker Desktop (optional)

Local development (`supabase start`) requires **Docker Desktop for Windows** running with the WSL 2 backend. Not needed if you only push migrations to the cloud.

### 1.7 Verify

```powershell
supabase --version
```

## 2. Connecting to the Cloud

The CLI talks to two surfaces: the **management API** (via an access token) and the **Postgres database** (via a DB password). Both need to be configured.

### 2.1 Log in (management API)

```powershell
supabase login
```

This opens a browser to generate a personal access token and stores it under `%USERPROFILE%\.supabase\access-token`. For headless/CI environments, set the token explicitly.

PowerShell (current session):

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

PowerShell (persisted for the user — opens a new shell to take effect):

```powershell
[Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", "sbp_xxxx...", "User")
```

`cmd.exe`:

```cmd
set SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Tokens are created at https://supabase.com/dashboard/account/tokens.

### 2.2 Link the local repo to a project

From the project root (the directory that contains or will contain `supabase\`):

```powershell
supabase link --project-ref <your-project-ref>
```

The project ref is the 20-character ID in the dashboard URL (`https://supabase.com/dashboard/project/<ref>`). You will be prompted for the **database password** — the one set when the project was created (or reset under *Project Settings → Database*).

To skip the prompt, store the password in an env var and pass it through:

```powershell
$env:SUPABASE_DB_PASSWORD = "your-db-password"
supabase link --project-ref <ref> --password $env:SUPABASE_DB_PASSWORD
```

Linking writes `supabase\.temp\` metadata and updates `supabase\config.toml`.

### 2.3 Initialize (only if `supabase\` does not exist yet)

```powershell
supabase init
```

Creates `supabase\config.toml`, `supabase\migrations\`, `supabase\seed.sql`, etc.

## 3. Pushing Migrations

Migrations are plain SQL files in `supabase\migrations\`, named `<timestamp>_<description>.sql`.

### 3.1 Create a new migration

```powershell
supabase migration new add_user_blocks_table
```

This creates an empty timestamped file. Write the DDL/DML by hand, or generate one from a local stack diff (requires Docker Desktop):

```powershell
supabase db diff -f add_user_blocks_table
```

### 3.2 Inspect what will run

Before pushing, always confirm the diff against the remote:

```powershell
supabase db diff --linked
supabase migration list           # shows local vs remote applied state
```

### 3.3 Push to the cloud

```powershell
supabase db push
```

This applies any local migrations that have not yet been recorded in the remote `supabase_migrations.schema_migrations` table. The CLI runs them in order, inside a transaction per file (where possible).

Useful flags:

- `--dry-run` — print the SQL that would run without executing it
- `--include-all` — re-apply migrations even if their hash differs (dangerous, see §4)
- `--db-url "postgresql://..."` — push to a non-linked target (e.g. a staging branch)

### 3.4 Roll forward, not back

The CLI does **not** auto-rollback. To revert a bad migration, write a new compensating migration. Never edit a migration file that has already been pushed — its hash is recorded remotely and changing it will fail subsequent pushes or, worse, cause divergence.

### 3.5 Branches (optional)

Supabase supports preview branches that mirror migrations from a Git branch:

```powershell
supabase branches create feature-x
supabase branches list
```

Each branch gets its own DB; `db push` against a branch ref is the safe way to rehearse a destructive migration.

## 4. Security: AI Agents with CLI Access

When an AI coding agent (Claude Code, Cursor, etc.) can shell out to `supabase` on your Windows machine, treat the CLI as a privileged subject. The access token grants **full management-API rights** on every project the user owns, and the linked DB password grants **superuser-equivalent** access to production data.

### 4.1 Threat model

- **Data exfiltration.** `supabase db dump`, `psql` via the connection string, or an ad-hoc `SELECT *` can pull PII, auth tokens, or Stripe data into the agent's transcript — which may be logged, cached by the model provider, or surfaced in future prompts.
- **Destructive migrations.** An agent that writes a `DROP TABLE`, a `TRUNCATE`, or a `NOT NULL` column without a backfill can corrupt production in one command. `supabase db push` does not require confirmation.
- **Prompt injection.** Untrusted content read by the agent (issue comments, scraped pages, even SQL comments in old migrations) can instruct it to run CLI commands. The CLI cannot tell whether a command came from the user or from a poisoned context.
- **Token leakage.** `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` in env vars can end up in PowerShell history (`(Get-PSReadlineOption).HistorySavePath`, typically `%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt`), in error logs, or be echoed into a transcript by a careless `Get-ChildItem Env:` call.
- **Cross-project blast radius.** A single access token is scoped to the user, not to a project. An agent linked to `project-A` can still call `supabase projects list` and operate on `project-B`.

### 4.2 Mitigations

**Project isolation**
- Use a dedicated Supabase **org** for production and keep the agent logged into a personal token that has access only to dev/staging orgs.
- For agents that must touch production, generate a **short-lived token** before the session and `supabase logout` after.

**Restrict what the agent can run**
- In Claude Code, use `.claude\settings.json` permissions to require explicit approval for `supabase db push`, `supabase db reset`, `supabase db dump`, and any `psql` invocation. Allow read-only commands (`supabase migration list`, `supabase db diff --linked`) without prompting.
- Never put the DB password into a permanently-exported user/machine env var. Prefer a secret manager:
  - **Windows Credential Manager** via `cmdkey` / the `CredentialManager` PowerShell module
  - **1Password CLI** (`op run -- supabase db push`) so the secret is injected only for the duration of the command and is not visible to `Get-ChildItem Env:`
- Clear PowerShell history after sessions that touched secrets: `Clear-History; Remove-Item (Get-PSReadlineOption).HistorySavePath`.

**Migration discipline**
- Require the agent to run `supabase db diff --linked` and `supabase db push --dry-run` before any real push, and to paste the SQL into the conversation for human review.
- Forbid editing files under `supabase\migrations\` that have already been applied. The agent should add a new file instead.
- Keep destructive operations (`DROP`, `TRUNCATE`, `ALTER ... DROP COLUMN`, broad `UPDATE` without `WHERE`) behind a manual step — the agent writes the SQL, a human runs the push.

**Data minimization**
- Do not let the agent run `supabase db dump` against production. If a dump is needed, dump from a branch or a scrubbed staging DB.
- Avoid `SELECT * FROM auth.users` (or any table with PII) inside an agent session. Filter columns and rows tightly; the output ends up in the transcript.
- Treat the agent transcript itself as a secrets-bearing artifact. Do not paste connection strings, JWT secrets, or service-role keys into the chat.

**Auditing**
- Supabase logs management-API calls under *Project Settings → Audit logs*. Review these after any agent-driven session that touched the cloud.
- Commit every migration the agent produces. A migration that exists in the DB but not in Git is a red flag.

**Service role keys**
- The `service_role` key bypasses RLS. Do **not** expose it to the agent's shell environment unless the task strictly requires it, and rotate it after the session ends. Prefer the anon key plus a tightly-scoped policy for any code the agent runs against the live API.

### 4.3 Quick checklist before letting an agent run `supabase db push`

- [ ] Linked to the right project ref (`supabase projects list` to confirm)
- [ ] Migration files reviewed by a human, not just by the model
- [ ] `--dry-run` output pasted into the conversation
- [ ] No `DROP` / `TRUNCATE` / unfiltered `UPDATE` without an explicit sign-off
- [ ] Access token is a short-lived or dev-scoped token, not a long-lived prod token
- [ ] PowerShell history cleared if any secret was typed inline
- [ ] Audit log checked after the push
