# build-android.ps1
# Builds a local Android APK for TTPortal without requiring EAS cloud.
# Usage: .\scripts\build-android.ps1 [-Clean] [-Release]

param(
    [switch]$Clean,
    [switch]$Release
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Set-Location $ProjectRoot

Write-Host "`n=== TTPortal Android APK Builder ===" -ForegroundColor Cyan

# ── 1. Verify prerequisites ──
Write-Host "`n[1/5] Checking prerequisites..." -ForegroundColor Yellow

# Node.js
try {
    $nodeVersion = node --version
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found. Install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Java (JDK 17)
try {
    $javaVersion = java --version 2>&1 | Select-Object -First 1
    Write-Host "  Java: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Java not found. Install JDK 17 from https://adoptium.net/" -ForegroundColor Red
    exit 1
}

# ANDROID_HOME
if (-not $env:ANDROID_HOME) {
    $defaultSdk = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $defaultSdk) {
        $env:ANDROID_HOME = $defaultSdk
        Write-Host "  ANDROID_HOME set to: $defaultSdk" -ForegroundColor Yellow
    } else {
        Write-Host "  ERROR: ANDROID_HOME not set and SDK not found at $defaultSdk" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green
}

# ── 2. Install dependencies ──
Write-Host "`n[2/5] Installing dependencies..." -ForegroundColor Yellow
npm install --silent
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: npm install failed" -ForegroundColor Red; exit 1 }
Write-Host "  Done" -ForegroundColor Green

# ── 3. Prebuild Android project ──
Write-Host "`n[3/5] Running Expo prebuild..." -ForegroundColor Yellow
if ($Clean) {
    Write-Host "  Clean build requested, removing android/ directory..." -ForegroundColor Yellow
    npx expo prebuild --platform android --clean
} else {
    npx expo prebuild --platform android
}
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: Prebuild failed" -ForegroundColor Red; exit 1 }
Write-Host "  Done" -ForegroundColor Green

# ── 4. Build APK ──
Write-Host "`n[4/5] Building APK..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\android"

$buildType = if ($Release) { "assembleRelease" } else { "assembleDebug" }
Write-Host "  Build type: $buildType" -ForegroundColor Yellow

if (Test-Path ".\gradlew.bat") {
    .\gradlew.bat $buildType
} else {
    Write-Host "  ERROR: gradlew.bat not found in android/" -ForegroundColor Red
    exit 1
}

if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: Gradle build failed" -ForegroundColor Red; exit 1 }
Write-Host "  Done" -ForegroundColor Green

# ── 5. Locate and copy APK ──
Write-Host "`n[5/5] Locating APK..." -ForegroundColor Yellow
Set-Location $ProjectRoot

$variant = if ($Release) { "release" } else { "debug" }
$apkDir = "android\app\build\outputs\apk\$variant"
$apkFiles = Get-ChildItem -Path $apkDir -Filter "*.apk" -ErrorAction SilentlyContinue

if ($apkFiles.Count -eq 0) {
    Write-Host "  ERROR: No APK found in $apkDir" -ForegroundColor Red
    exit 1
}

$apk = $apkFiles[0]
$outputName = "TTPortal-$variant.apk"
Copy-Item $apk.FullName -Destination "$ProjectRoot\$outputName" -Force

$sizeMB = [math]::Round($apk.Length / 1MB, 2)
Write-Host "`n=== Build Complete ===" -ForegroundColor Cyan
Write-Host "  APK: $outputName ($sizeMB MB)" -ForegroundColor Green
Write-Host "  Path: $ProjectRoot\$outputName" -ForegroundColor Green
Write-Host "`nTo install on a connected device:" -ForegroundColor Yellow
Write-Host "  adb install $outputName`n" -ForegroundColor White
