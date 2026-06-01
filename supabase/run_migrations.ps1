# TTPortal — Remote Supabase Migration Script (PowerShell)
# Usage: .\run_migrations.ps1 -Password "your-db-password"
#
# Runs all migrations in order against the remote Supabase database.
# Requires psql (PostgreSQL client) to be installed and in PATH.
# Download: https://www.postgresql.org/download/windows/

param(
    [Parameter(Mandatory=$true)]
    [string]$Password
)

$ErrorActionPreference = "Stop"

$Host_ = "aws-0-eu-central-1.pooler.supabase.com"
$Port = "6543"
$User = "postgres.vzewwlaqqgukjkqjyfoq"
$Database = "postgres"
$ConnString = "postgresql://${User}:${Password}@${Host_}:${Port}/${Database}?sslmode=require"

$MigrationsDir = Join-Path $PSScriptRoot "migrations"

$migrations = @(
    "000_pre_migration_rename.sql",
    "001_create_profiles.sql",
    "002_profiles_rls.sql",
    "003_core_tables.sql",
    "004_rls_policies.sql",
    "005_functions_views.sql",
    "006_seed_data.sql",
    "007_cloud_venues_sync.sql",
    "008_notifications.sql",
    "009_notification_triggers.sql",
    "010_migrate_old_data.sql"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TTPortal — Remote Database Migration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Host: $Host_" -ForegroundColor Gray
Write-Host "Database: $Database" -ForegroundColor Gray
Write-Host "Migrations: $($migrations.Count) files" -ForegroundColor Gray
Write-Host ""

# Check psql is available
try {
    $null = Get-Command psql -ErrorAction Stop
} catch {
    Write-Host "ERROR: psql not found. Install PostgreSQL client and add it to PATH." -ForegroundColor Red
    Write-Host "Download: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

# Confirm
Write-Host "This will run $($migrations.Count) migrations on the PRODUCTION database." -ForegroundColor Yellow
Write-Host "Old tables will be renamed to *_old (not deleted)." -ForegroundColor Yellow
$confirm = Read-Host "Continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Red
    exit 0
}

Write-Host ""

$failed = $false

foreach ($file in $migrations) {
    $path = Join-Path $MigrationsDir $file

    if (-not (Test-Path $path)) {
        Write-Host "[SKIP] $file — file not found" -ForegroundColor Yellow
        continue
    }

    Write-Host "[RUN ] $file ..." -ForegroundColor White -NoNewline

    $env:PGPASSWORD = $Password
    $output = & psql $ConnString -f $path -v ON_ERROR_STOP=1 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host $output -ForegroundColor Red
        $failed = $true
        Write-Host ""
        Write-Host "Migration stopped at $file. Fix the error and re-run." -ForegroundColor Red
        break
    } else {
        Write-Host " OK" -ForegroundColor Green
    }
}

Write-Host ""

if (-not $failed) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  All migrations completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Old tables preserved as: venues_old, cities_old, reviews_old, friendships_old" -ForegroundColor Gray
    Write-Host "You can drop them later with: DROP TABLE IF EXISTS venues_old, cities_old, reviews_old, friendships_old;" -ForegroundColor Gray
}

$env:PGPASSWORD = ""
