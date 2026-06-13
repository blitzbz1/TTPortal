# Building TTPortal Android APK on Windows

> ⚠️ **WARNING — local builds are DEBUG-SIGNED and must never be distributed.**
> The local `assembleRelease` output from this script is signed with the
> auto-generated debug keystore, not a release key. Anything handed to users
> or uploaded to a store MUST come from EAS:
>
> ```
> eas build --profile production --platform android
> ```
>
> which uses the real release keystore (managed via `eas credentials`) and a
> remote, auto-incremented `versionCode` (`eas.json`: `appVersionSource:
> "remote"`, `autoIncrement: true`). Verify any distributable with
> `apksigner verify --print-certs`. This script stays for local dev/testing
> only.

## OTA updates (expo-updates)

JS-only fixes do NOT need a new build — ship them over the air:

```
eas update --channel preview     # internal testers (preview builds)
eas update --channel production  # store/production builds
```

`runtimeVersion.policy` is `appVersion` (see `app.json`): any native change
(new native module, SDK upgrade, config-plugin change) requires bumping
`expo.version` and producing a **new build**; OTA only reaches builds whose
runtime version matches. One-time setup: `eas init` (writes the EAS
`projectId` + `updates.url` into `app.json`).

## Prerequisites

### 1. Node.js (v18+)
- Download from https://nodejs.org/
- Verify: `node --version`

### 2. JDK 17
- Download from https://adoptium.net/ (Eclipse Temurin)
- During install, check "Set JAVA_HOME variable"
- Verify: `java --version`

### 3. Android SDK
- Install [Android Studio](https://developer.android.com/studio)
- Open Android Studio > Settings > Languages & Frameworks > Android SDK
- Install **Android SDK Platform 34** (or latest)
- Install **Android SDK Build-Tools 34.x**
- Install **Android SDK Command-line Tools**

### 4. Environment Variables
Add these to your system environment variables:

```
ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk
```

Add to `PATH`:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
```

### 5. PowerShell Execution Policy
If scripts are blocked, run once as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Usage

Open PowerShell in the project root directory.

### Debug APK (for testing)
```powershell
.\scripts\build-android.ps1
```

### Release APK
```powershell
.\scripts\build-android.ps1 -Release
```

### Clean build (recreates android/ from scratch)
```powershell
.\scripts\build-android.ps1 -Clean
```

### Clean release build
```powershell
.\scripts\build-android.ps1 -Clean -Release
```

## Output

The APK will be copied to the project root:
- Debug: `TTPortal-debug.apk`
- Release: `TTPortal-release.apk`

## Installing on a device

### Via USB
Connect your Android device with USB debugging enabled, then:
```powershell
adb install TTPortal-debug.apk
```

### Via file transfer
Copy the APK to your device and open it to install. You may need to enable "Install from unknown sources" in your device settings.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ANDROID_HOME not set` | Set the environment variable as described above |
| `Java not found` | Install JDK 17 and ensure JAVA_HOME is set |
| `gradlew.bat not found` | Run with `-Clean` flag to regenerate the android project |
| `SDK license not accepted` | Run `%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager --licenses` |
| `Build fails on native module` | Run with `-Clean` to rebuild from scratch |
