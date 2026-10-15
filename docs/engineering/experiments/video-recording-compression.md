# Experiment Journal — Video Recording & Compression (Expo)

**Dates:** 2026-06-03 → 2026-06-04
**Stack:** Expo SDK 56 / RN 0.85.3
**Test device:** physical Redmi 23129RAA4G ("sapphire") — a **low-end Android**, chosen deliberately to prove performance on cheap hardware.
**Platform tested:** Android only. **iOS testing and numbers are still pending.**

---

## TL;DR

**Objective.** De-risk the Expo-vs-bare decision: can Expo record, compress, and upload video **without ejecting to bare React Native**? Recording + compression was the highest-risk item in that evaluation. We specifically wanted hard numbers on four questions: how big are 3–5 minute clips, can we compress them on-device without ejecting, how long does that compression take, and what recording controls does Expo actually give us.

**How we tested.** Built a "Lab" screen in the mobile app that records via `expo-camera`, plays back via `expo-video`, compresses via `react-native-compressor`, and uploads through the existing oRPC storage path — all on a low-end Android device, recording clips up to 5 minutes.

**Result: ✅ PASS for Expo (Android).** Nothing in the record → compress → upload pipeline forced a bare eject. Recommendation: **ship on `expo-camera` + `react-native-compressor`**, with `react-native-vision-camera` as a budgeted escape hatch if we later need finer camera control (fps, ML frame processors). **This verdict is Android-only until iOS is tested.**

**The numbers that matter (low-end Android):**

| Question | Answer |
|---|---|
| How big is a 5-min clip, raw? | **720 MB at 1080p**, 480 MB at 720p, 79 MB at 480p. |
| Can we compress on-device without ejecting? | **Yes.** `react-native-compressor` runs fully on-device, no native code we maintain, no eject. |
| How small does it get? | **~90% reduction**, consistently. A 720 MB 1080p clip → **54 MB**. |
| How long does compression take? | **~0.5–0.6× real-time** even on low-end — a 5-min clip compresses in **~2–3 min** in the background. |
| What recording controls do we get? | Resolution and (soft) bitrate via props — no fps control on `expo-camera`. |

**Interesting findings & concerns:**
- **`videoBitrate` is only a soft hint on Android** — we asked for 2 Mbps at record time and got 9.34. Don't rely on the record-time cap; compress after recording instead.
- **Compression auto-mode over-shrinks low-res sources** (480p → 0.22 Mbps, likely visibly degraded). Use manual bitrate with a floor for low-res inputs.

---

## Setup

Screen: `apps/mobile/src/app/(portal)/(tabs)/video-lab.tsx` — record via `expo-camera`, play back via `expo-video`, measure file size via `expo-file-system`, compress via `react-native-compressor`, upload via the existing oRPC storage path.

Deps added via `npx expo install`: `expo-camera`, `expo-video`, `expo-file-system`, `react-native-compressor`. Config plugins added for `expo-camera` (camera/mic permissions) and `react-native-compressor`.

## Phase A — raw recording (`expo-camera`, 30s clips)

| Quality | Size | Duration | Effective bitrate |
|---|---|---|---|
| 480p | 8.20 MB | 30.4s | 2.26 Mbps |
| 720p | 50.99 MB | 30.5s | 14.03 Mbps |
| 1080p | 72.70 MB | 31.2s | 19.52 Mbps |

`videoQuality` genuinely controls output — bitrate scales from 2.26 to 19.5 Mbps. The 720p/1080p defaults are upload-heavy.

## Phase B — compression (1080p, 31s clip)

| Approach | Size | Bitrate | vs raw | Time | Control |
|---|---|---|---|---|---|
| Raw (baseline) | 72.70 MB | 19.52 Mbps | — | — | — |
| Record-time cap (`expo-camera videoBitrate`=2M) | 34.72 MB | 9.34 Mbps | −52% | free | **loose** — asked 2, got 9.34 |
| `react-native-compressor` Auto (WhatsApp) | 5.69 MB | 1.56 Mbps | **−92.1%** | **13.2s** | heuristic |
| `react-native-compressor` Manual 2M | 8.85 MB | 2.43 Mbps | −87.7% | 32.5s | **hits target** |

## Phase A/B at scale — 5-minute clip (≈287s, low-end Redmi)

This is the headline case for the objective — real multi-minute clips on cheap hardware.

| Quality | Raw | Raw bitrate | Auto-compressed | Reduction | Compress time | Out bitrate |
|---|---|---|---|---|---|---|
| 1080p | 721.87 MB | 20.14 Mbps | 54.35 MB | 92.5% | 136.3s | 1.52 Mbps |
| 720p | 480.55 MB | 13.38 Mbps | 45.99 MB | 90.4% | 181.7s | 1.28 Mbps |
| 480p | 78.74 MB | 2.19 Mbps | 7.95 MB | 89.9% | 119.7s | 0.22 Mbps |
| 1080p (record-cap 2M) | 344.98 MB | 9.61 Mbps | — | −52% vs raw | — | cap loose (asked 2) |

- **5-min recording works** — no crash or cutoff (a "Long recording (5 min)" toggle raises the cap from 30s).
- **Compression runs at ~0.5–0.6× real-time even on low-end** (136–182s for ~287s) → a 5-min clip compresses in ~2–3 min in the background. This retires the "perf on low-end" risk at scale.
- **Auto normalizes to ~1.3–1.5 Mbps regardless of source resolution** (1080p ≈ 720p ≈ 46–54 MB), with ~90% reduction consistently.
- **Auto is too aggressive for 480p** (0.22 Mbps, likely visibly degraded) — use manual with a bitrate floor for low-res sources.

## Findings

- **`expo-camera` recording control is real** — resolution and bitrate via props, no native code. But `videoBitrate` is a **soft hint** on Android; you can't reliably hit a target at record time.
- **`react-native-compressor` is the reliable lever** — 88–92% reduction, Manual lands on the requested bitrate, ~1–2.4× real-time on a low-end device. It's the **same library bare RN would use**, so there's no Expo penalty. This retires the "perf on low-end" risk.
- **Recommended approach:** record at quality, then compress (Auto = smallest/fastest; Manual = precise bitrate). Don't rely on the record-time cap.

## OS floor (device support)

Nothing in this pipeline raises the minimum OS above the Expo SDK 56 baseline (**iOS 16.4+ / Android 7.0, API 24**). `react-native-compressor` (iOS 11 / Android API 21) and the codec APIs sit well below it; VisionCamera v5 (the escape hatch) is also below but requires the New Architecture. Caveat: API availability ≠ guaranteed behavior — bitrate-mode/operating-rate hints and HEVC hardware encode vary by device/OEM (matches the soft-bitrate and Adreno `KEY_OPERATING_RATE` findings).

## Camera depth — `expo-camera` vs `react-native-vision-camera`

- `expo-camera` (SDK 56) has **no fps prop** (records at device default). Controls: `videoQuality`, `videoBitrate` (soft), stabilization, zoom, flash.
- `react-native-vision-camera` adds: fps (24/30/60/120/240), exact format selection, HDR/codec, and **frame processors** (on-device ML).
- **VisionCamera is Expo-compatible** (config plugin + dev client) — swapping it in is ~0.5–1 day, **not** an eject. Frame processors add more setup (worklets).

## Verdict

On Android, Expo fully handles record → compress → upload with **no bare-RN eject**. Ship on `expo-camera` + `react-native-compressor`; keep VisionCamera as a budgeted escape hatch for finer camera control.

**Open items:**
- **iOS is untested** — all numbers and the pass verdict are Android-only so far. iOS recording, compression, and upload still need to be validated before this is a cross-platform decision.
- **Watch New-Architecture compatibility** of any new native dependency on this bleeding-edge SDK (RN 0.85 is New-Arch-only).

---

## Appendix — build journey (Android dev-build friction)

Kept for reference; none of this blocked the verdict, but it reflects the real setup cost of a dev build on SDK 56.

1. **Expo Go can't run SDK 56** — "requires a newer version of Expo Go". SDK 56/RN 0.85 is newer than the store Expo Go, so a **development build (dev client) is required**. (Standard; stays in Expo/EAS, not bare.)
2. **EAS cloud build** first (`eas-cli`, project `@mujahidalicl/mobile`, `eas.json` dev-client/internal-APK profile). The build succeeded but the free-tier queue was slow, so we switched to local.
3. **`expo-dev-client` is required** for a dev-client build — the first EAS attempt failed without it.
4. **Local Android build gotchas (all resolved):**
   - Default `java` is **JDK 25**, which RN 0.85's Gradle rejects → export `JAVA_HOME` to Homebrew **JDK 17** + `ANDROID_HOME=~/Library/Android/sdk`.
   - Added `android.package = com.conradlabs.mobile` and `apps/mobile/.nvmrc = 24` (repo pins Node ≥24 + `engine-strict`).
   - **Cold build ≈ 34 min; warm rebuild after a native change ≈ 32 s.**
   - `react-native-compressor` has `codegenConfig` → **New-Architecture compatible**. Compiled clean (including native C/C++), zero errors.
5. **MIUI install block:** `adb install` failed with `INSTALL_FAILED_USER_RESTRICTED` until **Developer Options → "Install via USB"** (plus "USB debugging (Security settings)") was enabled. `adb install -r` then succeeded. (Device policy, **not** an Expo issue.)
6. **USB wiring:** `adb reverse tcp:3000` (server) + `tcp:8081` (Metro) so the phone reaches `localhost` over the cable — no `.env` LAN-IP edit needed.
