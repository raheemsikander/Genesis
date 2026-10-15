# iOS dev build on a physical device (cable, free Apple ID)

Local iOS dev-client build — the `expo run:android` twin. No paid Apple account, no TestFlight.

## Prerequisites

Install these before starting. If you already have any of them, skip that step.

1. **macOS version** — Check the App Store listing for the latest Xcode to confirm your macOS meets the minimum requirement. Update macOS first if needed (System Settings → General → Software Update).
2. **Xcode** — Install from the Mac App Store (free, ~12 GB download).
3. **Xcode first launch** — Open Xcode and accept the license agreement. When prompted to select platforms, choose **iOS** (macOS is selected by default and fine to keep; skip watchOS/tvOS/visionOS). Close the Xcode welcome screen after this — you don't need to create or open a project from there.
4. **Node dependencies** — From the project root, install all monorepo dependencies (including mobile/Expo packages):
   ```bash
   pnpm install
   ```
5. **Docker Desktop** — Install from [docker.com](https://www.docker.com/products/docker-desktop/) and **open it** before running `pnpm infra:up`. The local infrastructure (PostgreSQL, Redis, MinIO) runs in Docker containers.

> **Note:** Xcode Command Line Tools are usually installed automatically with Xcode, and CocoaPods is auto-installed by `expo prebuild` (step 1 below). If you run into errors about missing CLI tools or CocoaPods, install them manually:
> ```bash
> xcode-select --install          # CLI tools
> brew install cocoapods           # CocoaPods
> ```

## One-time setup

All commands below assume you are in the **project root** (e.g. `~/Desktop/Genesis-2.0/`).

### 1. Generate the iOS project

The `ios/` directory does not exist in the repo — it is generated locally via Expo prebuild. Do **not** use `npx expo prebuild` (it installs its own copy of Expo); use `pnpm` so the monorepo's installed version is used:

```bash
pnpm --filter mobile exec expo prebuild --platform ios
```

### 2. Add your Apple ID to Xcode

Open Xcode. **Ignore the welcome screen** (Create New Project / Clone / Open Existing Project) — close it or leave it behind. Go to the **menu bar** at the top of the screen: **Xcode → Settings** (⌘,) → **Accounts** tab → click **+** → **Apple ID** → sign in with your personal Apple ID (free account is fine; this creates a "Personal Team").

### 3. Prepare your iPhone

Do this **before** configuring signing — Xcode needs a connected device to generate a provisioning profile.

1. Plug in via USB cable, unlock the phone, tap **Trust This Computer** when prompted.
2. **Enable Developer Mode** (iOS 16+): on the iPhone go to Settings → Privacy & Security → Developer Mode → toggle on → reboot. After rebooting, you may need to re-plug the cable and tap **Trust This Computer** again.

> If Xcode shows signing errors after enabling Developer Mode, restart your iPhone and re-open the Xcode workspace — the errors should clear.

### 4. Configure signing

Open the Xcode workspace from the terminal (use the full path):

```bash
open /full/path/to/Genesis-2.0/apps/mobile/ios/mobile.xcworkspace
```

In Xcode:
1. In the left sidebar, click the **mobile** project (blue icon at the very top).
2. In the middle panel under **TARGETS**, click **mobile**.
3. Click the **Signing & Capabilities** tab (not General — they look similar).
4. Check **Automatically manage signing** (may already be checked).
5. Under **Team**, select your **Personal Team** (your Apple ID name).

> If you see errors like "No profiles for 'com.conradlabs.mobile' were found", make sure your iPhone is plugged in and trusted (step 3), then click **Try Again**.

### 5. Keychain access prompt

During the first build, macOS will show a dialog: *"codesign wants to access key 'Apple Development: …' in your keychain"*. Enter your **Mac login password** (the one you use to unlock your Mac) and click **Always Allow**. This dialog may appear **multiple times** (up to 5–10 times) as Xcode signs different components — keep entering your password and clicking **Always Allow** each time until it stops.

> **If the dialog keeps looping endlessly**, try these in order:
> 1. Run this in a terminal to unlock the keychain, then retry the build:
>    ```bash
>    security unlock-keychain ~/Library/Keychains/login.keychain-db
>    ```
> 2. If it still loops: open **Keychain Access** (Spotlight → "Keychain Access"), find the "Apple Development" key for your Apple ID, double-click it → **Access Control** tab → set `codesign` to **Always Allow** (not just Allow) → Save. After that, the password dialogs should work normally.

## Network (required — iOS has no `adb reverse`)

iPhone reaches the server via the Mac's LAN IP, not `localhost`.

1. Connect iPhone and Mac to the **same Wi-Fi network**.
2. Find your Mac's LAN IP:
   ```bash
   ipconfig getifaddr en0
   ```
3. Create `apps/mobile/.env` by copying the example and filling in real values:
   ```bash
   cp apps/mobile/.env.example apps/mobile/.env
   ```
   Then edit `apps/mobile/.env` — set `EXPO_PUBLIC_SERVER_URL` to `http://<MAC_LAN_IP>:3000` using the IP from step 2. For the Clerk key, copy the value from your web env: `grep CLERK_PUBLISHABLE apps/web/.env`.
4. Server must bind `0.0.0.0`; allow port 3000 through the Mac firewall (System Settings → Network → Firewall — either disable or add an exception).

## Build & run

Make sure Docker Desktop is running, then open **4 terminal tabs** (all from the project root):

```bash
# Tab 1: Start local infrastructure (PostgreSQL, Redis, MinIO)
pnpm infra:up

# Tab 2: Start the API server
pnpm dev:server

# Tab 3: Start Metro bundler
pnpm dev:mobile

# Tab 4: Build, sign, install, and launch on your iPhone (keep phone unlocked)
cd apps/mobile
npx expo run:ios --device   # pick your iPhone when prompted; first build takes several minutes
```

### After the build finishes

1. The app installs on your iPhone but **will not open** the first time. Go to: **iPhone Settings → General → VPN & Device Management → [your Apple ID] → Trust**.
2. Open the app manually from the home screen. It connects to Metro over Wi-Fi.
3. If the app shows a "find dev servers" screen instead of loading, enter `http://<MAC_LAN_IP>:8081` manually.
4. You can **unplug the USB cable** after the app is installed — Metro connects over Wi-Fi. You only need the cable again to re-run `npx expo run:ios --device`.

### When do I need to rebuild?

| Change type | What to do |
|---|---|
| JS/TS code (components, screens, styles, logic) | Nothing — Metro hot-reloads automatically over Wi-Fi |
| Added/removed a native library (e.g. `expo-camera`) | Re-run `npx expo run:ios --device` (cable required) |
| Changed `app.json` / `app.config.js` native settings | Re-run `npx expo prebuild --platform ios` then `npx expo run:ios --device` |
| Signing expired (after 7 days) | Re-run `npx expo run:ios --device` (cable required) |

## Free-account caveats

- **Signing expires after 7 days** → re-run `npx expo run:ios --device` (cable) to re-sign.
- Capped at 3 apps / 10 devices — fine for a POC.
- iOS Simulator needs none of this (no account/cable/signing) but has **no real camera** — use the device for camera/compression testing.
