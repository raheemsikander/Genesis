# MCP Tools for Automated Mobile Testing

**Date:** 2026-06-10
**Context:** Expo SDK 56 app, for a team new to mobile dev.

---

## TL;DR

**What we wanted to find out.** Can we let an AI agent test our mobile app for us? The idea: the AI opens the running app, looks at the screen, taps and types like a real user, reads the logs, and tells us what broke — all from plain-English instructions. The tools that make this possible are called "MCP servers." We set out to see which ones exist and which we should use.

**How we looked.** We compared the popular community tools and the official ones from Apple, Google, and Expo. For each, we asked three simple questions: Does it work on both iPhone and Android? Can it run on real phones, not just simulators? And what can the AI actually do with it (tap, swipe, type, read logs)?

**What we actually tested.** We ran `mobile-mcp` for real and confirmed the AI can drive the app on **a real Android phone** and on **an iOS simulator** — both work. Everything else in this doc (driving a real iPhone, device clouds, `expo-mcp`) is based on the tools' documentation and community adoption, and **still needs to be verified hands-on.**

**What we landed on.** Use **two tools together**:
- **`mobile-next/mobile-mcp`** — the main tool. It works on both iPhone and Android, on simulators and real phones, and lets the AI do the most (tap, swipe, type, open and close apps).
- **`expo-mcp`** — a helper for our Expo setup. It adds a few things only it can do, like tapping elements by name and reading crash reports from TestFlight.

`mobile-mcp` is already set up in the project. The tools it needs (`xcrun simctl`, `adb`) are installed.

**Things worth knowing:**
- **The most popular tool wasn't the right fit.** The one with the most GitHub stars (`XcodeBuildMCP`) only works on iPhone. Once we limited the search to tools that work on both platforms, `mobile-mcp` was the clear winner.
- **The camera and mic don't work on simulators.** Things like GPS and fingerprint login can be faked, but the camera and mic can't (especially on iPhone simulators). **So our video recording feature has to be tested on a real phone**, not a simulator.

---

## What these tools do

An MCP server lets an AI agent control a running app. It can take screenshots, read what's on screen, tap, swipe, type, read logs and network traffic, open and close the app, and follow deep links. Because the agent can both *see* the screen and *act* on it, you can describe a test in plain English and let it run.

## Community landscape (GitHub stars, June 2026)

| Tool | Stars | What it covers |
|---|---|---|
| **mobile-next/mobile-mcp** | 5.2k | **iPhone + Android, simulators + real phones. Most active.** |
| getsentry/XcodeBuildMCP | 5.9k | iPhone/Mac + Xcode only |
| joshuayoes/ios-simulator-mcp | 2.0k | iPhone simulator only |
| Others (appium-mcp, react-native-*) | <70 | Niche, barely used |

`XcodeBuildMCP` has the most stars, but it only works on iPhone. Among the tools that work on **both** platforms, `mobile-mcp` is the clear, most-active leader.

## Official MCPs

- **expo-mcp** (from Expo) — matches our stack. It can take screenshots, tap (by position or by element name), find views, and open dev tools. It also handles EAS builds and TestFlight crash reports. **Its limits:** iPhone simulators only (no real phones, no Android), Mac-only, one dev server at a time, no swipe or type, and no camera/mic access.
- **Apple Xcode MCP** (iPhone only) and **Android Studio MCP** (Android only) — official, but each works on just one platform.

## Why two tools

- **mobile-next/mobile-mcp** is the workhorse. It does everything expo-mcp's automation does, plus swipe, type, open/close apps, **real phones**, multiple phones at once, and proper Android support.
- **expo-mcp** fills the gaps for our Expo workflow. Only it can target elements by name, open React Native dev tools, run EAS builds, and read TestFlight crashes.

## Constraints to know

- **OS versions:** the MCP drives whatever phone or simulator is already running — it doesn't install OS versions for you. You install those yourself (through Xcode or Android Studio) and test one at a time. (If several iPhone simulators are open, `mobile-mcp` uses the first one.) To test many versions at once, use a device cloud.
- **Camera and mic:** GPS, fingerprint login, and push notifications are easy to fake on a simulator. The camera and mic are not. An Android emulator can use your computer's webcam or a fake image (handy for QR codes); an iPhone simulator can't. Bluetooth and NFC need a real phone too.
  - ⚠️ **Our video recording and compression feature must be tested on a real phone.**
- **Real phones:** Android is easy — turn on USB debugging and plug it in (verified: we drove a real Android phone this way). iPhone is more involved. *Per the tools' documentation* (not yet tested by us), driving a real iPhone needs an automation agent (WebDriverAgent) signed and installed through Xcode, plus a tunnel for newer iOS versions. `expo-mcp` supports neither real-phone path; a device cloud skips all the setup.

**OS floor note.** These are developer-machine tools, not shipped code — they don't affect the app's end-user OS floor. (expo-mcp is macOS + iOS-simulator only; mobile-mcp drives real Android via `adb` and real iPhones via WebDriverAgent; EAS can build iOS without a Mac.)

## Next steps & status

- ✅ **Done:** `mobile-next/mobile-mcp` is set up as the main testing tool (added to the project's `.mcp.json`; needs a one-time approval in Claude Code). Prereqs installed (`xcrun simctl`, `adb`). AI-driven automation confirmed working on a **real Android phone** and an **iOS simulator**.
- ⬜ **To verify:** driving a **real iPhone** (the WebDriverAgent + tunnel setup above) — not yet attempted.
- ⬜ **To do:** add **expo-mcp** when we want its Expo-specific features (tapping by name, dev tools, EAS).
- ⬜ **To do:** test camera, mic, and video recording on a **real phone** or a device cloud (can't be done on a simulator).

## Sources

- https://github.com/mobile-next/mobile-mcp
- https://docs.expo.dev/eas/ai/mcp/
- https://developer.android.com/studio/run/emulator-use-camera
- https://github.com/browserstack/mcp-server
