# Experiment Journal — Audio Transcription on Mobile (On-Device + Cloud)

**Date:** 2026-06-04 → 2026-06-17 — **Status: IN PROGRESS**
**Feature:** standalone voice-to-text — *user records audio → transcribed → edits text → sends* (NOT the journaling video's audio).
**Objective:** Can we make speech-to-text work in the mobile app, and which approach/tool is best for our users (often elderly, often noisy rooms)?
**Test device:** physical Redmi 23129RAA4G (low-end Android). **iPhone not tested yet.**

---

## TL;DR

**What we wanted to find out.** Can we turn a user's recorded speech into text inside the mobile app, and what's the best tool for it? Our users are often elderly and often in noisy rooms, so **accuracy on hard audio is the make-or-break.**

**How we tested.** Two approaches, in order:
1. **On-device** (the phone does the transcription itself) using Expo's `expo-speech-recognition`. Tested on a low-end Android phone.
2. **Cloud** (record on the phone, send the audio to our server, transcribe via a paid API). We built this and compared **five providers** on several deliberately hard real-world clips — overlapping elderly speakers, a strong British accent, and pure background noise.

**What we found.**
- **Transcription works on mobile — both ways.** Neither approach forces us off Expo, so this doesn't affect the Expo-vs-bare decision.
- **On-device works but is the weaker option.** It runs offline and is free, but the Android version is less accurate on hard audio, and it needs a **one-time language-pack download** on first use (cloud has no such step). Good enough for simple cases; not for our hardest audio.
- **Cloud is the recommended path** for the accuracy our users need. After testing five providers, **AssemblyAI Universal-3 Pro is the standout** — most accurate and consistent across all clips, honest confidence scores, and the cheapest of the premium tier. **Deepgram Nova-3** is the fast fallback (best latency, but weaker on accents).

**Recommendation:** Go cloud, with **AssemblyAI Universal-3 Pro as the primary** and **Deepgram Nova-3 as a low-latency fallback**. Keep on-device in reserve for if offline/privacy ever becomes a hard requirement.

**Things worth knowing:**
- **One provider silently made things up.** On pure background noise, Speechmatics invented a plausible sentence and reported **91% confidence** — a dangerous failure for noisy real-world use. The good engines (AssemblyAI, Deepgram) correctly returned nothing. **Speechmatics is dropped** for this product.
- **There's no single "best" provider — it depends on the audio.** Deepgram led on overlapping US dialogue but stumbled on a British accent; OpenAI was cleanest on short clear clips but repeats itself on long ones. AssemblyAI was the most consistent across all of them.
- **Don't trust confidence scores across vendors.** Some report ~99% while making clear errors. Treat confidence as a within-one-engine signal only.

**Still open:**
- **Real-time (streaming) transcription for the cloud providers** is not yet tested — so far we send the whole clip after recording.
- **iPhone is completely untested** — both on-device and cloud have only been tried on Android.
- On-device accuracy on clear vs. noisy vs. elderly speech not yet formally characterized.

---

## Setup

Screen: `apps/mobile/src/app/(portal)/(tabs)/speech-lab.tsx` (a "Speech" tab) — record → live transcript → editable text → "Send", with an **"On-device only"** toggle (`requiresOnDeviceRecognition`) and an offline-model check.

Dep: `npx expo install expo-speech-recognition` (`^56.0.0`). Config plugin configured with mic + speech-recognition permissions and `androidSpeechServicePackages`. Required a dev-client rebuild — **~32 s warm** (only the new native module compiled; camera/compressor cached).

## Findings / gotchas so far

1. **Android on-device needs the offline language model downloaded.** First on-device attempt: *"language not supported — supported but not downloaded."* On-device STT can't run until the language pack is on the device (Android System Intelligence, `com.google.android.as`). Added a **"Download offline model"** button calling `androidTriggerOfflineModelDownload({ locale: "en-US" })`, and pointed the installed-locale check at `com.google.android.as` (the on-device recognizer, not the Google-app/network one). This is a real on-device UX cost: first-run model download (needs connectivity + storage once) — cloud STT has no such step.

2. **Premature endpointing with `continuous: false`.** First real test:
   - **On-device:** captured only a few words, then stopped — **poor**.
   - **Network (on-device toggle OFF):** no speech recognized (`no-speech`).
   - Diagnosis: with `continuous: false`, Android endpoints on the first short silence. Switched to **`continuous: true`** (runs until the user taps Stop) + extended silence intent options (`EXTRA_SPEECH_INPUT_*_SILENCE_LENGTH_MILLIS`).
   - **Retest: on-device now captures full sentences — clearly better** (continuous mode was the fix; offline model also finished downloading). Accuracy characterization (clear/noisy/elderly) pending.

3. **No working platform/"device-cloud" STT on this device (confirmed).** Toggling on-device OFF first threw `network`; after discovering the device's only recognizer is **`com.google.android.tts` ("Speech Services by Google")** and targeting it explicitly with `requiresOnDeviceRecognition: false`, it produced **no error but no transcription** — it silently no-ops on network. `com.google.android.tts` on modern Android does **on-device only** (Google consolidated recognition on-device), so there is no platform network recognizer to test here. Diagnosed via `getSpeechRecognitionServices()` / `getDefaultRecognitionService()` (now shown in the screen header). **This is NOT the cloud path we'd build** — real cloud STT = record audio → send to our server → STT API (Deepgram/Whisper) → text, which never uses the device recognizer. So the platform-network dead end has **no bearing on the cloud recommendation**.

4. **Playback added** (`expo-audio` + `recordingOptions.persist`) — plays back the captured audio to confirm mic vs recognizer when STT returns nothing.

## Research — on-device vs cloud (2025–26)

| Dimension | On-device | Cloud |
|---|---|---|
| Latency | ~300–500 ms, near-real-time | ~500–1200 ms + network |
| Accuracy | Lower (small models) | Higher (large models) |
| Noisy / accented / elderly | Weakest spot | Markedly better |
| Cost | none / predictable | ~$0.006–0.024 /audio-min |
| Privacy / offline | Best | Audio leaves device; needs network |
| Battery / app size | Drain + model size | Zero device cost |

- Platform asymmetry: Apple's on-device `SpeechAnalyzer` (iOS) now ≈ mid-tier Whisper; **Android platform STT is weaker** (matches our result).
- Hard-audio accuracy: clean ≈ <5% WER but challenging audio 15–20%. Noisy leaders: AssemblyAI Universal-2 / Speechmatics Ursa 3 (~8%), Deepgram Nova-3 (8.2%, best latency); Whisper/Google lead on accents. No granular elderly benchmarks — accented+noisy is the proxy.
- General rule: on-device for privacy/offline/low-latency/high-volume; **cloud when accuracy on hard audio matters**.

**For this app → lean cloud.** Record→edit→send tolerates ~1s latency; accuracy on noisy/elderly is the make-or-break (cloud wins); cost trivial at beta scale. On-device only if privacy/offline becomes a hard requirement (and even then, stronger on iOS than the Android path tested). A/B shortlist on real elderly/noisy clips: AssemblyAI, Deepgram Nova-3, Whisper-large / gpt-4o-transcribe.

## Stack conclusion (already determined — does not block)

Transcription is **neutral for the Expo-vs-bare decision**:
- Audio capture = first-party `expo-audio`.
- STT = either **cloud/server-side** (orthogonal) or **on-device `expo-speech-recognition`** (Expo-compatible config plugin + dev client).
Neither path forces bare RN.

## OS floor (device support)

Cloud STT has no device floor, so the recommended cloud path keeps the app at the Expo SDK 56 baseline (iOS 16.4 / Android 7). On-device is the exception: on-device recognition needs **Android 13+** (plus the per-locale model download noted above), and Apple's stronger on-device API (SpeechAnalyzer) is **iOS 26+** and not exposed by `expo-speech-recognition` today. `whisper.rn` sidesteps the OS floor (iOS 13 / app-set Android) at the cost of bundling model weights.

## Open / next

- **Streaming (real-time) cloud transcription** not yet tested — current cloud path sends the whole clip after recording. Test live/streaming transcription for the front-runners.
- **iPhone testing** — both on-device and cloud paths have only run on Android so far. iOS on-device STT is expected to be stronger (Apple `SpeechAnalyzer`); needs confirming on a real iPhone.
- **On-device accuracy characterization** — capture accuracy on clear vs noisy vs elderly-style speech + latency (continuous mode now captures full sentences; quality not yet measured).
- If on-device platform STT stays weak on the hard cases → escalate to **`whisper.rn`** (bundled model), or lean **cloud STT** (already the recommendation given the accuracy requirement).
- Larger provider A/B on more real elderly/noisy clips before committing to a primary.

## Cloud STT build — Deepgram Nova-3 (server-side)

Built the real cloud path (the device has no usable platform cloud STT). New `transcription` oRPC domain mirroring `storage`:
- **shared**: `TranscribeAudioInputSchema` (File) + `TranscribeAudioResultSchema` (transcript/confidence/durationSec/model) — `packages/shared/src/models/transcription.types.ts`.
- **contract**: `transcriptionContract.transcribeAudio` (`packages/orpc-contracts`).
- **server**: `transcription.service.ts` calls Deepgram `POST /v1/listen?model=nova-3&smart_format=true&punctuate=true` via **`fetch`** (no `@deepgram/sdk` dep); API key server-side only. `transcription.controller.ts` (`protectedProcedure`). Registered in `appRouter`.
- **env**: `DEEPGRAM_API_KEY` (optional) in `env.ts` + `.env.example` + CLAUDE.md. **Terraform/Render rollout NOT wired** (experiment; do it via `cl-adding-environment-variable` when promoting to staging/prod).
- **mobile**: `api/transcription.api.ts` (`useTranscribeAudio`) + a "Transcribe via Deepgram (cloud)" button in `speech-lab.tsx` that uploads the recorded clip → shows transcript + confidence + duration. JS-only (no rebuild — File upload reuses the existing oRPC multipart path).

Verified: `check-types` (all), Biome (changed files), `build` (server+web), server unit tests (51/51). Pending: live on-device test (needs `DEEPGRAM_API_KEY` in `apps/server/.env` + server restart).

**Tooling gotcha found:** `pnpm check` = `biome check --write .`, and `biome.json` `files.includes` does NOT ignore `**/android` or `**/ios`. After a local `expo run:android`, the generated `apps/mobile/android/` dir makes `pnpm check` emit ~1500 errors / reformat ~180 generated files (gitignored, so no tracked pollution; CI is clean since it has no prebuild). Fix: add `!**/android` and `!**/ios` to `biome.json` `files.includes`.

## Multi-provider comparison results — 2026-06-16

Built the 5-engine "Run all engines" harness (`provider` param on `transcribeAudio`; mobile fans out 5 parallel calls). Branch `genesis-173-audio-transcription`. Spec/plan in this dir (`2026-06-16-multi-provider-stt-comparison-*.md`).

**Test clip:** ~195s real-world sample — an elderly couple reminiscing, two overlapping spontaneous speakers, emotional/quiet passages. A deliberately *hard* clip (the make-or-break case).

| Engine | Confidence | Server latency¹ | Chars | Verdict on this clip |
|---|---|---|---|---|
| **AssemblyAI Universal-3 Pro** | 91.8% | 15.7s | 1898 | **Best dialogue fidelity** — caught the two-speaker call-and-response ("Yes, we have been", "He never does that", "Did you?") others merged or dropped. Honest confidence. |
| **Deepgram Nova-3** | 99.0% | **4.9s** | 1828 | **Fastest**, smart-formatted date (`08/23/1975`). A few mishears ("Truth just didn't catch me", "Is you?", garbled final line). Strong all-rounder. |
| **OpenAI gpt-4o-mini-transcribe** | — | 7.4s | 1794 | Clean, readable, cheapest — but **flattens the two speakers into one voice** ("I think I've been very fortunate to find a bride", losing the back-and-forth). No confidence/duration. |
| **OpenAI gpt-4o-transcribe** | — | 11.0s | 2192 | ⚠️ **Repetition/looping hallucination** — repeated the closing passage ~3× (inflated char count). Known failure mode on long/ambiguous audio. Disqualifying despite good base text. |
| **Speechmatics Enhanced** | 99.1% | 20.3s | 1821 | Solid but one clear garble: "Yes, we have been **trying to ride. That would take care of me**" = mangled "to find a bride that would take care of me". Confidence inflated vs actual errors. |

¹ Server-side wall-clock (receive ~2.3 MB upload + provider round-trip) for a 195s clip. Async engines (AssemblyAI, Speechmatics) are inflated by our 2–3s poll interval — not raw engine speed. Sync engines (Deepgram, OpenAI) return as soon as the API responds.

### Takeaways (Drill 1 — interim; see "Overall recommendation" below for the verdict after all drills)

- **Front-runners: AssemblyAI Universal-3 Pro and Deepgram Nova-3.** AssemblyAI is the most faithful to the actual conversation (preserves speaker turns); Deepgram wins on latency + formatting with slightly more mishears. Either is a defensible primary.
- **gpt-4o-transcribe's looping is a real risk** for unattended transcription — its full model hallucinated repeats while the *mini* model did not. If using OpenAI, mini was the more reliable of the two here.
- **Confidence scores are not comparable across vendors.** Deepgram/Speechmatics report ~99% while making audible errors; AssemblyAI's 91.8% is lower but its transcript is arguably the most accurate. Treat confidence as an intra-engine signal only.
- **Cost** (from the prior pricing pass) doesn't separate the front-runners at beta scale — decide on accuracy. AssemblyAI U-3 Pro ($0.0035/min) is also cheaper than Deepgram Nova-3 ($0.0077/min).
- **Interim read (drill 1 only):** shortlist **AssemblyAI Universal-3 Pro** (accuracy/dialogue) vs **Deepgram Nova-3** (latency) for a larger A/B on more elderly/noisy clips before committing. Drop gpt-4o-transcribe (looping); keep gpt-4o-mini only as a cheap fallback. (Confirmed and extended by drills 2–4 below.)

### Drill 2 — British-accented single speaker (~42s, "marriage advice" clip) — 2026-06-17

Run server-side (bypassing the mobile app / Clerk) via `apps/server/scripts/stt-drill.ts`, which calls the five provider functions directly on a local audio file.

| Engine | Confidence | Latency | Accuracy on this clip |
|---|---|---|---|
| **OpenAI gpt-4o-transcribe / mini** | — | 4.5 / 4.8s | **Cleanest** — "Marriage isn't hunky-dory", "Ta-da, I'm on my way". No errors; no looping (short clip). |
| **AssemblyAI Universal-3 Pro** | 92.0% | 9.1s | Clean + **accent-faithful** ("on **me** way", "tada"). |
| **Speechmatics Enhanced** | 98.7% | 11.0s | One real error: "stronger for **him**" (→ "for it"); dropped "ta-da". |
| **Deepgram Nova-3** | 96.8% | **3.2s** | **Worst here** — two accent mishears: "**Madam** isn't hunky dory" (→ Marriage), "**trudder**" (→ ta-da). Fastest. |

**Key finding — the front-runner depends on audio profile.** Deepgram led drill 1 (overlapping US dialogue) on speed/formatting but **stumbled on this British accent** (two clear mishears), while OpenAI + AssemblyAI were cleanest. gpt-4o-transcribe did *not* loop here (it looped on drill 1's longer clip), reinforcing that its looping risk scales with clip length/ambiguity. Net: **AssemblyAI U-3 Pro is the most consistent across both drills** (clean + honest confidence in each); Deepgram is fastest but accent-sensitive; OpenAI is strong on clean/short audio but length-risky.

**Infra note:** 3/5 engines first failed with `getaddrinfo ENOTFOUND` — the test network's router DNS (`192.168.100.1`) returns NXDOMAIN for some provider hosts (Deepgram, AssemblyAI) while resolving others. Switching the machine to `8.8.8.8`/`1.1.1.1` fixed it. This same flaky DNS is the likely cause of the mobile app's "could not connect to Clerk" — set the device's Wi-Fi DNS to a public resolver if it recurs.

### Drill 3 — crowd babble / no intelligible speaker (~2 min "group of people talking" SFX) — 2026-06-17

A noise-robustness / hallucination test (no clear foreground speech).

| Engine | Confidence | Output |
|---|---|---|
| **Deepgram Nova-3** | 0 | *(empty)* — returned nothing ✅ |
| **AssemblyAI Universal-3 Pro** | 0 | *(empty)* — returned nothing ✅ |
| **OpenAI gpt-4o-mini** | — | *(empty)* ✅ |
| **OpenAI gpt-4o-transcribe** | — | "I know." — minor fabrication ⚠️ |
| **Speechmatics Enhanced** | **91%** | Hallucinated ~102 chars of invented dialogue ("I know. You didn't come in. Okay... What did you do?") **at 91% confidence** ❌ |

**Most decision-relevant finding so far.** On unintelligible noise, **Deepgram and AssemblyAI correctly return empty with `conf=0`** — the safe behavior for a product used by elderly speakers in noisy rooms. **Speechmatics fabricates plausible text and reports 91% confidence on pure noise** — a dangerous silent-failure mode (garbage injected with no low-confidence signal). gpt-4o fabricated a small snippet; gpt-4o-mini stayed silent.

### Drill 4 — street interview, clear single speaker, disfluent casual speech (~32s) — 2026-06-17

Convergence case — all five produced good, near-identical transcripts. Differentiator was verbatim fidelity to disfluencies/repeats: **AssemblyAI, Deepgram, Speechmatics, and gpt-4o-mini preserved them** (e.g. "People are— people are mean"); **gpt-4o-transcribe normalized them away** (most readable, least verbatim). Deepgram had one minor slip ("the blanket that [I] had on me"). AssemblyAI again gave the most honest confidence (88.2% on messy speech vs ~99% from Deepgram/Speechmatics). No hallucination from any engine — there was real speech to anchor on (contrast drill 3). Conclusion unchanged.

### Pricing (English, pay-as-you-go) — pre-recorded verified 2026-06-16, streaming verified 2026-06-19

Cost columns below assume **100 users × 10 transcriptions/day = 30,000 clips/month** (see "Cost at scale" below), priced at 1-, 2-, and 5-minute average clip length.

$/mo columns are **pre-recorded** at the volume above. The **Streaming** column is the per-minute real-time rate (only Deepgram + AssemblyAI were wired for streaming).

| Engine | Pre-rec $/min | Streaming $/min | 1 min ($/mo) | 2 min ($/mo) | 5 min ($/mo) | Free tier |
|---|---|---|---|---|---|---|
| AssemblyAI Universal-3 Pro | **$0.0035** | **$0.0075**² | $105 | $210 | $525 | $50 credit |
| OpenAI gpt-4o-mini-transcribe | **$0.003** | ~$0.017³ | $90 | $180 | $450 | none |
| Speechmatics Enhanced | **~$0.004**¹ | RT tier⁴ | ~$120 | ~$240 | ~$600 | 40 hrs/mo |
| OpenAI gpt-4o-transcribe | **$0.006** | ~$0.017³ | $180 | $360 | $900 | none |
| Deepgram Nova-3 | **$0.0077** | **$0.0048** | $231 | $462 | $1,155 | $200 credit |

¹ Speechmatics publishes only a "from $0.24/hr" floor; exact tier rates are behind sign-up. Priced but **not** tested: Google Chirp ~$0.016/min (interactive), Azure ~$0.006–0.0167/min.
² `u3-rt-pro` streaming model (matches the U-3 Pro we benchmarked). Our live code connects without a `speech_model`, so it actually streams the cheaper default **Universal-Streaming** model at **$0.0025/min** — a *different, lighter* model than the batch accuracy winner. Set `speech_model: "u3-rt-pro"` to stream the benchmarked engine.
³ OpenAI realtime API (`gpt-realtime`); not wired in this experiment.
⁴ Speechmatics real-time tier (above its batch rate); not re-verified, not wired.

> ⚠️ **Idle-connection cost (streaming).** **AssemblyAI bills by WebSocket session duration, not audio sent** — an open-but-silent socket still bills (their docs: "a WebSocket open for 60 minutes with 30 minutes of audio is billed for 60 minutes"). Deepgram bills audio processed (it sends `KeepAlive` text frames during silence), so an idle Deepgram socket is far cheaper. **In both cases close the socket the moment a session ends, and prefer hold-to-talk over a long-lived open mic.** `stopLive` closes both sockets, but there is **no unmount cleanup yet** (deferred minor) — navigating away mid-session can leak an open (and billing) AssemblyAI socket. Fix before any non-experimental use.

**Cost does not override the accuracy verdict — it reinforces it.** The recommended primary (AssemblyAI U-3 Pro, $0.0035/min) is among the cheapest and ~half the price of Deepgram Nova-3 ($0.0077). At beta scale the spread is trivial: 1,000 one-minute notes/month ≈ **$3.50 (AssemblyAI) vs $7.70 (Deepgram)**. Streaming, if pursued later, is priced separately and billed on connection time for some vendors (e.g. AssemblyAI) — revisit then.

**Even at the heaviest profile (5-min clips), the recommended primary stays at ~$525/mo** — well within budget for 100 users. The AssemblyAI-vs-Deepgram spread (~2.2×) only becomes material if volume grows an order of magnitude, which reinforces AssemblyAI U-3 Pro as the primary on both accuracy and cost.

### Overall recommendation (after 4 drills)

**AssemblyAI Universal-3 Pro is the standout:** clean on dialogue (drill 1) and accent (drill 2), and correctly silent on noise with honest confidence (drill 3) — and it's the cheapest of the premium tier ($0.0035/min). **Deepgram Nova-3** is the strong, fastest alternative (best latency, honest on noise) but accent-sensitive. **Drop Speechmatics** for this product — the high-confidence hallucination on noise is disqualifying for elderly/noisy use. **OpenAI gpt-4o-transcribe** carries length-scaled looping + noise-fabrication risk; **gpt-4o-mini** is a reasonable cheap fallback (silent on noise, clean on short clips) but flattens multi-speaker audio. Proposed primary: **AssemblyAI U-3 Pro**, with Deepgram Nova-3 as the low-latency fallback.

### Method note

Results were captured with throwaway tooling that was **removed before commit** (kept out of product code):
- Drill 1 (mobile): a temporary `logger.info("transcription result", …)` line in `transcription.service.ts` that logged the full transcript.
- Drills 2–4 (server-side): a local `stt-drill.ts` script that ran an audio file through all five providers directly (no oRPC/Clerk/mobile).

Neither is in the repo. The committed surface is the feature code in `apps/server/src/controllers/transcription/` (provider modules + dispatch) and `apps/mobile/.../speech-lab.tsx` (the "Run all engines" comparison UI), which reproduces the comparison on-device.

## Streaming (live) results — 2026-06-18

Built and validated live, as-you-speak transcription: device captures PCM via `expo-audio` `useAudioStream` (int16/16 kHz/mono), fans it to **both** Deepgram and AssemblyAI simultaneously over WebSockets, with short-lived tokens minted server-side (`transcription.streamToken`) so the long-lived keys never reach the device and **no audio transits our server** (device → provider direct). Tested on the physical Redmi (Android), dual live panes.

**Live first-word latency (measured from audio start, same zero point for both), two samples:**

| Sample | Deepgram first-word | AssemblyAI first-word | Quality winner |
|---|---|---|---|
| 1 | 4.0s | **2.5s** | AssemblyAI |
| 2 | **4.5s** | 4.7s | AssemblyAI |

**Read:** first-word latency is **comparable and sample-dependent** — sample 1 favored AssemblyAI (2.5 vs 4.0s), sample 2 was effectively a tie (4.5 vs 4.7s). No consistent latency winner in streaming (unlike batch, where Deepgram was the clear latency leader). **Transcription quality, however, favored AssemblyAI in both samples** — that's the consistent signal. So AssemblyAI is the primary pick across batch *and* streaming, driven by **quality and consistency**, not a streaming latency edge. *(Still only two live samples — repeat on noisy/accented speech before treating any latency gap as definitive.)*

### Engineering findings (temp-token-direct streaming)

- **Architecture validated:** temp-token, direct-to-provider works end-to-end. Audio never touches our server; the server only mints tokens. Per-provider failure is isolated (when Deepgram was misconfigured, AssemblyAI streamed fine).
- **Deepgram needs a Member+ key** to mint client tokens via `POST /v1/auth/grant` — a restricted/usage-only key returns `403 FORBIDDEN "Insufficient permissions"` (even though it works for batch `/v1/listen`).
- **Deepgram JWT WS auth uses the `bearer` Sec-WebSocket-Protocol keyword**, not `token`. `/auth/grant` returns a JWT; `["token", jwt]` is rejected and the socket closes with code **1006**; `["bearer", jwt]` succeeds. (The `token` keyword is only for raw API keys.) Fixed in `deepgram-stream.ts`.
- **AssemblyAI** is simpler for client streaming: any key mints a token (`GET /v3/token`), passed as a `?token=` query param (no header/subprotocol dance).
- Providers commit at different cadences (Deepgram per `is_final`; AssemblyAI on formatted end-of-turn) — final text converges, intermediate timing differs.

### Still open (streaming)

- iOS untested (Android dev client only).
- Single live sample — repeat on noisy/accented speech for a robust latency/quality read.
- In-session token refresh not implemented (short sessions only; 60s token redemption windows).
- No reconnect/backpressure hardening, and no unmount cleanup of the mic/sockets (logged as deferred minors).
