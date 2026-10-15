# Mobile Stack Recommendation: Expo vs Bare React Native

**Scope:** `apps/mobile` (Expo SDK 56 / RN 0.85) — greenfield video + voice-note app, closed beta, team new to React Native.

---

## TL;DR

**The decision.** Should we build the mobile app on **Expo** or go with **bare React Native**? Expo is faster and easier to work with, but only if it can actually handle what this app needs. So before committing, we wanted to answer three questions:
1. Can Expo handle the **riskiest features** — recording, compressing, and transcribing video and audio **on the device**?
2. What situations would **force us to abandon Expo** and go bare?
3. Can we still **write our own native code** while staying on Expo?

**How we decided.** We didn't decide on paper — we built and tested the risky parts. We ran real experiments for on-device video recording + compression and for audio transcription (the two features most likely to break Expo), and we checked Expo's escape hatches for adding native code.

**The recommendation: build on Expo.** Our experiments confirmed the risky features all work on Expo without going bare — on-device video recording + compression, audio recording, and transcription. (Details in the linked experiment docs. iOS video is still to be tested.)

**What Expo gives us out of the box:**
- **Ready-made building blocks** for the hard stuff — camera, audio, video, file storage, secure storage, navigation — all first-party and kept compatible, so we don't hunt down and vet separate libraries.
- **Our own native code when we need it** — we can add custom native modules and settings without going bare. We did exactly this to plug in video compression.
- **Easy version upgrades** — Expo keeps React Native upgrades manageable instead of hand-editing dozens of native files.

**Even if we don't use Expo's paid cloud (EAS), we still keep most of the wins.** The building blocks above, adding native code, and the easy upgrades all work with builds we run ourselves. Expo's cloud is a convenience (building in the cloud, building iPhone apps without a Mac, and pushing instant updates) — not a requirement, and not a lock-in.

**Things worth knowing:**
- **"Ejecting" isn't really a thing anymore.** You'd only go fully bare for niche reasons (embedding into an existing native app, a native SDK Expo can't support, or heavy ongoing native-build customization) — **none of which are on our roadmap.**
- **Expo is also the officially recommended choice.** The React Native team now points new apps to a framework, and Expo is the only one they recommend.
- **iOS hasn't been tested for video yet** — the experiments so far were Android-focused. The recommendation holds, but iOS video needs validating before we treat it as fully proven.

---

## Recommendation

Build on **Expo** (managed + custom dev client + EAS). Every feature this app needs is served within Expo without ejecting to bare React Native — and where a stronger option exists, it's either also Expo-compatible or lives server-side.

## Official guidance

React Native team ([blog, 2024-06-25](https://reactnative.dev/blog/2024/06/25/use-a-framework-to-build-react-native-apps)): Expo is the **recommended** way to create new apps — *"you're either using a framework or you're building your own framework."* Framework-less RN stays supported but is aimed at brownfield/internal cases; **Expo is the only officially recommended community framework.**

## Feature-by-feature

| Feature | Expo provides | Pros | Cons | Alternative |
|---|---|---|---|---|
| **Video recording** | `expo-camera` | Built-in; resolution + bitrate control; no native code | No fps control; bitrate is a soft hint | `react-native-vision-camera` — fps, exact formats, frame processors (**also Expo-compatible** via config plugin) |
| **Video compression** | `react-native-compressor` (config plugin + dev client) | Strong size reduction; can hit a target bitrate; works on low-end devices | Third-party native dep → needs a dev build; verify New-Arch support | Same library in bare RN (identical); or server-side transcode |
| **Audio recording** | `expo-audio` | First-party, simple, no native code | — | — |
| **Voice → text (on-device)** | `expo-speech-recognition` (platform STT) | Free, offline, private | Platform accuracy weak on noisy/elderly speech; one-time model download | **Cloud STT** (Deepgram/Whisper, server-side) — best accuracy; or `whisper.rn` bundled model on-device |
| **Device/OS support** | Set by SDK 56 | iOS 16.4+ / Android 7+ | Excludes pre-2017 iPhones | Same floor in bare RN 0.85 (set by RN + store policy, not Expo) |

## Expo-specific advantages (framework-level)

Wins from Expo the framework, independent of any single feature:

| Advantage | What it gives you | Bare RN equivalent |
|---|---|---|
| **OTA updates (EAS Update)** | Push JS/asset fixes to **installed production builds** instantly, no store review. **Independent of Expo Go** — it targets your real shipped builds (Expo Go is only a dev sandbox). JS only; native changes (new module, SDK bump, permissions) still need a new build. | No first-party OTA (CodePush diminished after App Center's 2025 retirement) |
| **CNG / prebuild** | Native `ios`/`android` projects generated from `app.json` + config plugins — nothing hand-maintained | Hand-edit Podfile / Gradle / manifests |
| **EAS Build / Submit** | Cloud native builds (incl. **iOS without a Mac**), managed signing, store submission | Local Xcode/Android toolchain + manual signing |
| **Managed SDK upgrades** | `expo install` + a version-aligned SDK keep RN upgrades tractable | Manual upgrade across many native files |
| **First-party modules** | `expo-camera` / `-audio` / `-video` / `-file-system` / `-secure-store` / `-router` — guaranteed compatible | Source and vet each native dep yourself |
| **Config plugins** | Declarative native config — reproducible and AI-friendly | Hand-edited native config |

## When you'd leave Expo

"Eject" no longer exists. Config plugins, local Expo modules, and `expo prebuild` cover almost everything. Going fully bare is only forced by brownfield (embedding in an existing native app), a native SDK incompatible with CNG, or deep continuous native-build customization — **none on this roadmap**.

---

*Detailed experiment data (measurements, build process, gotchas): see [`experiments/`](experiments/) — [video recording & compression](experiments/video-recording-compression.md), [on-device transcription](experiments/audio-transcription-on-device.md).*
