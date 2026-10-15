# Streaming (Live) Cloud STT — Design

**Date:** 2026-06-17
**Status:** Approved (pending spec review)
**Branch:** `genesis-173-audio-transcription` (worktree: `.claude/worktrees/genesis-streaming`)
**Context:** Extends the audio-transcription experiment. Batch (record → upload → transcribe) is built and compared across five providers (see `audio-transcription-on-device.md`). This adds **live, as-you-speak** transcription and compares the two batch front-runners — **Deepgram Nova-3** and **AssemblyAI** — streaming side by side on the same mic input.

## Goal

Validate end-to-end live cloud transcription on the mobile app: speak → interim words appear within a second → text finalizes. Capture real latency and the UX feel, and compare Deepgram vs AssemblyAI streaming on identical audio. Android first; iOS out of scope for this cut.

## Key decisions (from brainstorming)

- **Architecture: temp-token, direct device → provider.** The app fetches a short-lived streaming credential from our server (over the existing authed oRPC), then opens a WebSocket straight to the provider. The long-lived API key never leaves the server; audio never transits our infra; latency is one hop. Both providers support this.
- **Providers: Deepgram + AssemblyAI, simultaneously.** One mic stream is fanned to two WebSockets so the comparison is on identical audio in real time.
- **Audio capture: first-party `expo-audio`.** No third-party native module (the brainstorm's "Expo-first" check found `useAudioStream`).

## Verified facts

- `expo-audio@56.0.11` (already a dependency, native module already in the dev client for playback) exports **`useAudioStream(options)`** with:
  - `AudioStreamOptions = { sampleRate?: number (def 48000); channels?: number (def 1); encoding?: 'float32' | 'int16' (def 'float32'); onBuffer?: (buffer: AudioStreamBuffer) => void }`
  - `AudioStreamBuffer = { data: ArrayBuffer; sampleRate: number; channels: number; timestamp: number }`
  - We request `{ sampleRate: 16000, channels: 1, encoding: 'int16' }` → linear16 16 kHz mono PCM as an `ArrayBuffer`, which both providers accept and RN's `WebSocket` can send as a binary frame.

## Architecture

```
expo-audio useAudioStream(onBuffer)          ── one mic, PCM int16 16k mono ArrayBuffer frames
        │
        ├──────────────► WebSocket #1 ──► Deepgram   wss://api.deepgram.com/v1/listen?... (temp key)
        │                                   ◄── interim/final transcripts
        └──────────────► WebSocket #2 ──► AssemblyAI  realtime WS (temp token)
                                            ◄── interim/final transcripts

Token mint (once per session, before connecting):
  app ──(authed oRPC: protectedProcedure)──► server ──(server-side key)──► provider token API ──► short-lived token
```

### Server (only backend work)

A `transcription.streamToken` oRPC procedure on `protectedProcedure` that, given a `provider` (`"deepgram" | "assemblyai"`), mints and returns a short-lived streaming credential using the existing server-side env key. Reuses `DEEPGRAM_API_KEY` / `ASSEMBLYAI_API_KEY`.

- **Shared:** `StreamTokenInputSchema = { provider: TranscriptionProviderSchema-subset }`, `StreamTokenResultSchema = { provider, token: string, expiresInSec: number }`.
- **Contract:** add `streamToken` to `transcriptionContract`.
- **Server:** `transcription.controller.ts` adds the handler; `transcription.service.ts` (or a `providers/stream-tokens.ts`) implements per-provider minting:
  - Deepgram: create a short-TTL scoped key via Deepgram's key API (server key → temporary key with `usage:write`/listen scope, ~60s TTL). **Exact endpoint/params verified against current Deepgram docs at implementation time.**
  - AssemblyAI: POST the realtime/streaming temporary-token endpoint (server key → temp token, short expiry). **Exact endpoint verified at implementation time.**
- Errors follow the existing pattern: missing key → internal `Error` (500, not leaked); upstream failure → `ORPCError("BAD_GATEWAY")`.

No WebSocket server, no audio relay, no `ws` dependency on Express. The streaming connections are device→provider.

### Mobile

Files under `apps/mobile/`:
- `src/api/transcription.api.ts` — add `getStreamToken(provider)` calling the new endpoint via the raw client (mirrors `transcribeAudioWith`).
- `src/streaming/deepgram-stream.ts` — a small client: given a temp token + an event sink, opens the Deepgram WS (correct query params: `model=nova-3&encoding=linear16&sample_rate=16000&channels=1&interim_results=true`), exposes `sendPcm(ArrayBuffer)` and `close()`, parses interim/final transcript messages, and sends Deepgram's keepalive/close control messages.
- `src/streaming/assemblyai-stream.ts` — same shape for AssemblyAI's realtime protocol (its own connect params + message format).
- `src/streaming/types.ts` — a shared `StreamingSession` interface: `{ sendPcm(buf): void; close(): void }` and a `StreamEvent` union (`{ type: 'partial' | 'final'; text }`, `{ type: 'open' }`, `{ type: 'error'; message }`) so the UI treats both providers uniformly.
- `speech-lab.tsx` — a **"Live" mode**: a start/stop control that (1) fetches both tokens, (2) opens both sessions, (3) starts `useAudioStream`, fanning each `onBuffer` frame to both sessions, (4) renders two live panes (one per provider) showing committed text + the current interim tail, plus a latency readout (ms from stream start to first partial). Stop closes both sockets and the stream. Reuses the existing `live`/`commit` text-accumulation idea, one accumulator per provider.

### Data flow (happy path)

1. User taps "Start live". App requests both temp tokens (2 parallel authed calls).
2. App opens both WebSockets; on both `open`, starts `useAudioStream({ sampleRate:16000, channels:1, encoding:'int16', onBuffer })`.
3. Each `onBuffer` → `deepgram.sendPcm(buffer.data)` and `assemblyai.sendPcm(buffer.data)`.
4. Each provider streams partial transcripts (update the interim tail) and finals (append to committed text). UI shows both panes updating live.
5. User taps "Stop" → flush/close both sockets, stop the stream, leave both final transcripts on screen for comparison.

## Error handling

- Token mint failure (e.g. missing/invalid key) → that provider's pane shows an error; the other still runs.
- WebSocket error/close mid-stream → pane shows "disconnected"; no auto-reconnect in this cut (logged as out-of-scope below).
- Mic permission denied → surfaced before starting (reuse existing permission flow).
- Each provider pane is independent — one failing never blocks the other or the mic stream.

## Testing

- **Server:** unit-test the `streamToken` dispatch (provider routing + missing-key path), mirroring the existing `transcription.service.test.ts` (mock the provider token funcs). No live network in unit tests.
- **Manual (device):** Android dev client — start live, speak, confirm interim text appears < ~1s in both panes and finalizes; confirm latency readout; confirm stopping closes cleanly; confirm one provider's token failure leaves the other working.

## Scope / milestones

- **M1:** Deepgram live — one pane, interim → final text on Android, latency shown.
- **M2:** add AssemblyAI — both panes, simultaneous, side-by-side.

## Out of scope (this cut)

- iOS (Android dev client only for now).
- Reconnect/backpressure hardening, partial-frame buffering tuning.
- Persisting transcripts or a saved comparison.
- Streaming for the other three providers (OpenAI realtime, Speechmatics RT) — Deepgram + AssemblyAI are the front-runners.
- Production token-rotation/refresh for sessions longer than one token TTL (note it; short sessions only for the experiment).

## Risks / to verify at implementation start (in the worktree)

1. **`useAudioStream` in the installed/built dev client** — confirm `node_modules/expo-audio` exposes it and that the existing dev client binary includes the native `AudioStream` code (it should, same 56.0.11 module). If not → one dev-client rebuild.
2. **Exact provider token APIs** — Deepgram scoped/temporary key endpoint + TTL; AssemblyAI realtime temp-token endpoint. Verify against current official docs (as we did for batch) before coding the minting functions.
3. **PCM ↔ provider params** — encoding/sample-rate must match the WS connect params exactly (linear16, 16000, mono); mismatch yields garbage or silence.
4. **RN binary WebSocket send** — confirm `ws.send(arrayBuffer)` transmits binary frames the providers accept; set `binaryType` if needed.
5. **Token TTL vs session length** — short-lived tokens may expire during a long live session; acceptable for the experiment (short sessions), note for productionization.
