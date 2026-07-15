# Supabase CLI — Quick Start (Windows)

Minimal steps to install the CLI, log in, and push a migration.

## 1. Install

Using Scoop (https://scoop.sh):

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

## 2. Log in

```powershell
supabase login
```

Opens a browser to authorize and stores the access token locally.

## 3. Link the repo to your project

Run from the project root:

```powershell
supabase link --project-ref <your-project-ref>
```

The project ref is in your dashboard URL: `https://supabase.com/dashboard/project/<ref>`. Enter the database password when prompted.

## 4. Create and push a migration

```powershell
supabase migration new add_something
# edit the generated SQL file under supabase\migrations\
supabase db push
```

Check what will run first with:

```powershell
supabase db diff --linked
supabase db push --dry-run
```
