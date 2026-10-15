# Multi-Provider Cloud STT Comparison — Design

**Date:** 2026-06-16
**Status:** Approved (pending spec review)
**Context:** Extends the `genesis-173-audio-transcription` experiment. The Deepgram Nova-3 cloud path is built and verified working on-device. This adds four more cloud STT engines behind the same flow so the same recorded/picked clip can be transcribed by all of them in parallel and compared side by side (accuracy + latency).

## Goal

Run one audio clip through five cloud STT engines at once and read the transcripts side by side, each annotated with latency and (where available) confidence — to decide which engine wins on real noisy/elderly speech. Pricing was already compared and is effectively a non-differentiator at beta scale, so this experiment is decided on accuracy.

## Engines

| Provider key | Engine / model | API shape | Auth |
|---|---|---|---|
| `deepgram` | Nova-3 | sync `POST /v1/listen` (already built) | `DEEPGRAM_API_KEY` (set) |
| `assemblyai` | Universal-3 Pro | async: upload → create job → poll | `ASSEMBLYAI_API_KEY` (new) |
| `openai-gpt4o` | gpt-4o-transcribe | sync multipart `POST /v1/audio/transcriptions` | `OPENAI_API_KEY` (new) |
| `openai-gpt4o-mini` | gpt-4o-mini-transcribe | sync multipart (same endpoint, different `model`) | `OPENAI_API_KEY` (new) |
| `speechmatics` | Enhanced (Ursa) | async: create job (multipart) → poll → fetch transcript | `SPEECHMATICS_API_KEY` (new) |

Google Chirp 2 was deliberately deferred (needs service-account auth + a GCS bucket for >~1 min audio — heaviest to build and set up; its accuracy edge is on accents, which the other four also cover).

## Architecture

The app fans out: it calls the existing `transcription.transcribeAudio` endpoint **five times in parallel** (once per provider). Each result lands independently, so transcripts stream in as each engine finishes and one engine failing doesn't sink the others. The clip uploads to our server 5× — acceptable on Wi-Fi for a few-MB experiment clip, and it keeps the server change minimal and the failure handling clean.

### Shared schema (`packages/shared/src/models/transcription.types.ts`)

- Add `TranscriptionProviderSchema = z.enum(["deepgram", "assemblyai", "openai-gpt4o", "openai-gpt4o-mini", "speechmatics"])` and its inferred type.
- `TranscribeAudioInputSchema` gains `provider: TranscriptionProviderSchema` (required).
- `TranscribeAudioResultSchema` gains `provider: TranscriptionProviderSchema` (echoed back so the client can match a result to its card). Existing fields unchanged: `transcript: string`, `confidence: number | null`, `durationSec: number | null`, `model: string`.

### Contract (`packages/orpc-contracts/src/contracts/transcription.contract.ts`)

No structural change — `transcribeAudio` picks up the updated input/output schemas automatically.

### Server (`apps/server/src/controllers/transcription/`)

Refactor the single Deepgram service into a provider dispatch:

```
transcription.controller.ts   // unchanged shape: protectedProcedure → service
transcription.service.ts      // dispatch on input.provider → provider module; attach `provider` to result
providers/
  deepgram.ts        // existing fetch logic moved here (sync)
  openai.ts          // sync; multipart to /v1/audio/transcriptions; model arg selects gpt-4o vs mini
  assemblyai.ts      // async: POST /v2/upload → POST /v2/transcript → poll GET /v2/transcript/{id}
  speechmatics.ts    // async: POST /v2/jobs (multipart config) → poll GET /v2/jobs/{id} → GET transcript
```

- Each provider module exports `(file: File) => Promise<{ transcript; confidence; durationSec; model }>`. The dispatcher adds `provider` to the returned object.
- The shared `MAX_FILE_SIZE_BYTES` guard stays in the service (before dispatch).
- Async providers (AssemblyAI, Speechmatics) use a bounded poll loop: fixed interval (~1.5 s) with a max-wait cap (~5 min) so a 3-min clip completes but a stuck job fails cleanly.
- `confidence` is `null` for engines that don't return one (OpenAI). `durationSec` is `null` where not returned (OpenAI); AssemblyAI/Speechmatics/Deepgram provide it.

### Error handling (follows existing Deepgram pattern, per `cl-error-handling`)

- **Missing API key** → throw a plain `Error` (interceptor logs it as a 500; not surfaced to the client as a user error). This keeps a misconfigured engine from leaking config detail, and the other four still run.
- **Upstream failure, non-OK response, or poll timeout** → `ORPCError("BAD_GATEWAY", { message: "Transcription failed" })` (or "… service unreachable" for network errors).
- **Oversize file** → `ORPCError("PAYLOAD_TOO_LARGE")`.
- Each parallel client call resolves/rejects independently; the UI shows a per-engine error state without affecting the others.

### Env (`apps/server`, per `cl-adding-environment-variable`)

Three new **optional** vars: `ASSEMBLYAI_API_KEY`, `OPENAI_API_KEY`, `SPEECHMATICS_API_KEY`. Wired in `src/utils/env.ts` (optional), `.env.example`, and the CLAUDE.md env section. Absent key → that engine errors clearly; others unaffected (graceful, matching Deepgram's `enabled: false`-style degradation).

### Mobile (`apps/mobile`, per `cl-design-agent` + `expo:native-data-fetching`)

- `speech-lab.tsx`: replace the single "Transcribe via Deepgram (cloud)" button with **"Run all engines"** (shown when a clip URI exists).
- On press: build the blob **once** via the existing `uriToBlob` helper, then fire **five parallel** calls with `Promise.allSettled`, each tracked in per-provider state (`{ status: "pending" | "done" | "error"; latencyMs; result?; error? }`).
- **Latency** measured client-side per call (`Date.now()` around each `mutateAsync`).
- Render a **stacked result card per engine**, updating as each settles: provider label, status, latency (ms), confidence (if present), model, and the transcript (selectable text). Built from the existing `Card` / `Button` / `Text` primitives and design tokens — no new UI library.
- The on-device live preview and the editable transcript box stay as-is.
- `transcription.api.ts`: keep the `useTranscribeAudio` mutation; the screen manages the five-way fan-out and per-provider state locally.

## Implementation risks (resolve against current docs at build time, not from memory)

- **Exact model identifiers / params:** AssemblyAI `speech_model` value for Universal-3 Pro; Speechmatics `transcription_config.operating_point` (`enhanced`) and the job-config/transcript-format endpoints; OpenAI `model` strings (`gpt-4o-transcribe`, `gpt-4o-mini-transcribe`) and `response_format`. Verify via Context7 / official docs while implementing.
- **AssemblyAI auth header** uses the raw key (`Authorization: <key>`), not `Bearer`. **Speechmatics** uses `Bearer` and has region-specific endpoints — pick the standard one and note it.
- **Poll tuning:** interval + max-wait so a 3-min clip doesn't time out (cap ~5 min).

## Verification

- `pnpm check-types`, `pnpm check` (Biome), `pnpm build`.
- `pnpm test:server:unit` — add a focused test for the provider dispatch (unknown/each provider routes correctly; missing-key path throws). Existing 51 must stay green.
- Live device test: record/pick a clip → "Run all engines" → confirm all five engines that have keys return transcripts with latency + confidence.

## Out of scope

- Google Chirp 2 (deferred).
- Streaming / live cloud transcription (separate, larger effort already scoped in conversation).
- Persisting comparison results / a leaderboard — this is a manual eyeball comparison for now.
- Promoting any provider to production or wiring keys into Terraform/Render (experiment only).
