# Android & PWA Packaging Guide for ShopLedger SaaS

ShopLedger SaaS is designed and built from the ground up with an **offline-first Progressive Web App (PWA)** architecture, utilizing modern Service Workers (`public/sw.js`), IndexedDB local storage (`src/lib/offline/db.ts`), and Web App Manifest (`public/manifest.json`).

This guide details three production packaging pathways to deliver ShopLedger to Android devices:
1. **Direct PWA Installation (Instant, Zero Build Required)**
2. **Trusted Web Activity (TWA) with Google Bubblewrap (Recommended for Google Play Store)**
3. **Capacitor Integration (For Deep Hardware Bluetooth / POS Printer / Barcode SDK Access)**

---

## 1. Direct PWA Installation (Mobile Browser)

Any Android user with Chrome, Edge, Brave, or Samsung Internet can install ShopLedger directly as a standalone app:

1. Open your deployed ShopLedger URL (e.g. `https://shopledger.app` or your Vercel deployment) in Android Chrome.
2. An automated **"Add ShopLedger to Home screen"** install banner appears.
3. Tap **Install** or tap the 3-dot menu -> **"Install App"**.
4. The app icon installs on the Android home screen and app drawer.
5. Launches in full-screen standalone mode with:
   - Dedicated Android splash screen and theme color (`#4f46e5`).
   - Full offline caching of dashboard, sales, inventory, and ledgers.
   - Background background sync queue with auto-retry.

---

## 2. Google Bubblewrap CLI (Trusted Web Activity - TWA)

Google's official **Bubblewrap CLI** compiles a Progressive Web App into a native Android Application Bundle (`.aab`) or APK (`.apk`) using Chrome's Trusted Web Activity (TWA).

### Prerequisites
- **Node.js 18+** installed
- **Java Development Kit (JDK 17+)** installed
- **Android SDK command-line tools** installed (or Android Studio)

### Step 1: Install Bubblewrap CLI
```bash
npm install -g @bubblewrap/cli
```

### Step 2: Initialize Bubblewrap Project
Run Bubblewrap pointing to your live production domain:
```bash
bubblewrap init --manifest=https://your-production-domain.com/manifest.json
```
Bubblewrap will read the manifest and ask you to confirm:
- **Application Name**: ShopLedger
- **Package ID**: `app.shopledger.twa`
- **Host**: `your-production-domain.com`
- **Start URL**: `/dashboard`
- **Theme Color**: `#4f46e5`
- **Signing Keystore**: Generate a new keystore or specify an existing one.

### Step 3: Configure Digital Asset Links (`assetlinks.json`)
To remove the browser address bar completely and run as a seamless native app, link your domain with your Android app's SHA-256 fingerprint:

1. Locate the generated SHA-256 fingerprint from Bubblewrap output or your keystore:
   ```bash
   keytool -list -v -keystore android.keystore -alias android
   ```
2. Bubblewrap generates an `assetlinks.json` file. Place it in your public folder at:
   `public/.well-known/assetlinks.json`
   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "app.shopledger.twa",
         "sha256_cert_fingerprints": [
           "YOUR_SHA256_FINGERPRINT_HEX_STRING_HERE"
         ]
       }
     }
   ]
   ```
3. Deploy to production so `https://your-domain.com/.well-known/assetlinks.json` is publicly reachable.

### Step 4: Build the Android Package
```bash
bubblewrap build
```
This produces:
- `app-release-bundle.aab` (Upload to Google Play Console)
- `app-release-signed.apk` (Direct distribution / testing on Android devices)

### Testing APK on Device via ADB
```bash
adb install -r app-release-signed.apk
```

---

## 3. Alternative: Ionic Capacitor Integration

If you need native SDKs (e.g. specialized ESC/POS Bluetooth thermal printers or hardware barcode laser scanners):

### Step 1: Install Capacitor
```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
```

### Step 2: Initialize Capacitor
```bash
npx cap init ShopLedger app.shopledger.saas --web-dir out
```

### Step 3: Add Android Platform
```bash
npx cap add android
```

### Step 4: Sync & Open in Android Studio
```bash
npm run build
npx cap copy android
npx cap open android
```
From Android Studio, click **Build -> Generate Signed Bundle / APK** to create your release `.aab` or `.apk`.

---

## 4. Current Status & Publishing Notice

> [!IMPORTANT]
> **Status Disclosure**:
> - ShopLedger SaaS has been verified and tested as a **responsive PWA** with offline caching (`sw.js`), full IndexedDB schema (`idb`), and Web App Manifest (`public/manifest.json`).
> - The application is **not currently published or submitted** to the Google Play Store console.
> - To publish to Google Play Store, you must have a registered Google Play Developer Account ($25 one-time fee), deploy ShopLedger to a verified public HTTPS domain, host `.well-known/assetlinks.json`, and submit the generated `.aab` file.
