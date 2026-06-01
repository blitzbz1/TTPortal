# Building TTPortal Android APK on Windows

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
