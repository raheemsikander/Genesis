# Multi-Provider Cloud STT Comparison — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run one audio clip through five cloud STT engines in parallel and compare their transcripts, latency, and confidence side by side in the mobile Speech tab.

**Architecture:** Add a `provider` param to the existing `transcription.transcribeAudio` oRPC endpoint. Server dispatches per-provider to thin HTTP adapter modules (Deepgram + OpenAI are sync; AssemblyAI + Speechmatics are async upload→poll). The mobile app fans out five parallel calls (one per provider) and renders a result card per engine as each settles.

**Tech Stack:** Zod (`@repo/shared`), oRPC contract + Express handler, Node global `fetch`/`FormData`, Vitest (server unit tests), React Native + NativeWind (mobile), TanStack via raw oRPC client for fan-out.

**Spec:** `docs/engineering/experiments/2026-06-16-multi-provider-stt-comparison-design.md`

**Verified API shapes (2026, from official docs):**
- OpenAI: `POST https://api.openai.com/v1/audio/transcriptions`, multipart `file`+`model`, `Authorization: Bearer`, models `gpt-4o-transcribe`/`gpt-4o-mini-transcribe`, `response_format` `json` (default) or `text` only, transcript in top-level `text`, no confidence/duration.
- AssemblyAI: upload raw bytes `POST /v2/upload` (`authorization: <KEY>` no Bearer, `content-type: application/octet-stream`) → `upload_url`; `POST /v2/transcript` JSON `{ audio_url, speech_models: ["universal-3-pro","universal-2"] }` → `id`; poll `GET /v2/transcript/{id}` `status` ∈ `queued|processing|completed|error`; fields `text`, `confidence` (0–1), `audio_duration` (seconds).
- Speechmatics: `POST https://asr.api.speechmatics.com/v2/jobs` (`Authorization: Bearer`), multipart `data_file` + `config` JSON string `{type:"transcription",transcription_config:{language:"en",operating_point:"enhanced"}}` → top-level `id`; poll `GET /v2/jobs/{id}` `job.status` ∈ `running|done|rejected`; `GET /v2/jobs/{id}/transcript?format=json-v2` → `results[].alternatives[0].content` (concat; punctuation has no leading space), per-item `confidence`, `job.duration` (seconds).

---

## File Structure

- `packages/shared/src/models/transcription.types.ts` — **modify**: add `TranscriptionProviderSchema`; add `provider` to input + result schemas.
- `apps/server/src/utils/env.ts` — **modify**: add 3 optional keys.
- `apps/server/.env.example` — **modify**: add 3 keys.
- `CLAUDE.md` — **modify**: env section.
- `apps/server/src/controllers/transcription/providers/types.ts` — **create**: shared `ProviderResult` type.
- `apps/server/src/controllers/transcription/providers/poll.ts` — **create**: bounded poll helper.
- `apps/server/src/controllers/transcription/providers/poll.test.ts` — **create**.
- `apps/server/src/controllers/transcription/providers/deepgram.ts` — **create** (move existing logic).
- `apps/server/src/controllers/transcription/providers/openai.ts` — **create**.
- `apps/server/src/controllers/transcription/providers/assemblyai.ts` — **create**.
- `apps/server/src/controllers/transcription/providers/speechmatics.ts` — **create**.
- `apps/server/src/controllers/transcription/transcription.service.ts` — **rewrite**: dispatch.
- `apps/server/src/controllers/transcription/transcription.service.test.ts` — **create**.
- `apps/server/src/controllers/transcription/transcription.controller.ts` — **modify**: pass `input.provider`.
- `apps/mobile/src/utils/orpc.ts` — **modify**: export raw `client`.
- `apps/mobile/src/api/transcription.api.ts` — **rewrite**: `transcribeAudioWith(file, provider)`.
- `apps/mobile/src/app/(portal)/(tabs)/speech-lab.tsx` — **modify**: "Run all engines" + result cards.

---

## Task 1: Shared schema — provider enum + input/result

**Files:**
- Modify: `packages/shared/src/models/transcription.types.ts`

- [ ] **Step 1: Add the provider schema and extend input/result**

Replace the body of `transcription.types.ts` with:

```ts
import { z } from "zod";

// Permissive File validation (same shape as the storage upload): a browser/RN File, or a
// blob-like object carrying `name`/`size`. oRPC ships the bytes as multipart.
const AudioFileSchema = z.custom<File>(
	(val) =>
		val instanceof File ||
		(typeof val === "object" && val !== null && "name" in val && "size" in val),
);

export const TranscriptionProviderSchema = z.enum([
	"deepgram",
	"assemblyai",
	"openai-gpt4o",
	"openai-gpt4o-mini",
	"speechmatics",
]);

export type TranscriptionProvider = z.infer<typeof TranscriptionProviderSchema>;

export const TranscribeAudioInputSchema = z.object({
	file: AudioFileSchema,
	provider: TranscriptionProviderSchema,
});

export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

export const TranscribeAudioResultSchema = z.object({
	transcript: z.string(),
	confidence: z.number().nullable(),
	durationSec: z.number().nullable(),
	model: z.string(),
	provider: TranscriptionProviderSchema,
});

export type TranscribeAudioResult = z.infer<typeof TranscribeAudioResultSchema>;
```

- [ ] **Step 2: Confirm the model is re-exported**

Run: `grep -n "transcription" packages/shared/src/models/index.ts`
Expected: a line `export * from "./transcription.types";` (already present from the original experiment). If it's a named re-export instead, add `TranscriptionProviderSchema` / `TranscriptionProvider` to it.

- [ ] **Step 3: Type-check**

Run: `pnpm check-types`
Expected: PASS (the server still compiles — `input.provider` isn't consumed yet but the schema is valid; the contract auto-picks up the new fields).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/models/transcription.types.ts
git commit -m "feat(genesis-173): add provider to transcription schemas"
```

---

## Task 2: Server env vars (AssemblyAI, OpenAI, Speechmatics)

**Files:**
- Modify: `apps/server/src/utils/env.ts`
- Modify: `apps/server/.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the keys to the env schema**

In `apps/server/src/utils/env.ts`, find the `DEEPGRAM_API_KEY` line in the `server` object and add three optional keys next to it:

```ts
		DEEPGRAM_API_KEY: z.string().optional(),
		ASSEMBLYAI_API_KEY: z.string().optional(),
		OPENAI_API_KEY: z.string().optional(),
		SPEECHMATICS_API_KEY: z.string().optional(),
```

If this file uses `@t3-oss/env-core` with an explicit `runtimeEnv` map, also add the matching lines there:

```ts
		ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY,
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		SPEECHMATICS_API_KEY: process.env.SPEECHMATICS_API_KEY,
```

(Check whether `DEEPGRAM_API_KEY` appears in a `runtimeEnv` block; mirror exactly what it does.)

- [ ] **Step 2: Add to `.env.example`**

In `apps/server/.env.example`, near the `DEEPGRAM_API_KEY` line add:

```
# Cloud STT comparison experiment (all optional; an engine without a key just errors individually)
ASSEMBLYAI_API_KEY=
OPENAI_API_KEY=
SPEECHMATICS_API_KEY=
```

- [ ] **Step 3: Update CLAUDE.md**

In `CLAUDE.md`, in the **Server** optional env vars list, change the `DEEPGRAM_API_KEY` entry to include the new keys, e.g. append:
`, ASSEMBLYAI_API_KEY, OPENAI_API_KEY, SPEECHMATICS_API_KEY (additional cloud STT providers for the transcription comparison experiment)`.

- [ ] **Step 4: Verify the server still boots**

Run: `pnpm -F server exec tsx -e "import('./src/utils/env').then(()=>console.log('env ok'))"` (or just `pnpm check-types`)
Expected: no validation error (all three are optional).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/utils/env.ts apps/server/.env.example CLAUDE.md
git commit -m "feat(genesis-173): add AssemblyAI/OpenAI/Speechmatics env keys"
```

---

## Task 3: Poll helper (TDD)

**Files:**
- Create: `apps/server/src/controllers/transcription/providers/poll.ts`
- Create: `apps/server/src/controllers/transcription/providers/poll.test.ts`

- [ ] **Step 1: Write the failing test**

`poll.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pollUntil } from "./poll";

describe("pollUntil", () => {
	it("resolves with the value once poll reports done", async () => {
		let calls = 0;
		const value = await pollUntil<string>({
			intervalMs: 1,
			timeoutMs: 1000,
			poll: async () => {
				calls += 1;
				return calls < 3
					? { status: "pending" }
					: { status: "done", value: "hello" };
			},
		});
		expect(value).toBe("hello");
		expect(calls).toBe(3);
	});

	it("throws when poll reports an error", async () => {
		await expect(
			pollUntil({
				intervalMs: 1,
				timeoutMs: 1000,
				poll: async () => ({ status: "error", error: "rejected" }),
			}),
		).rejects.toThrow("rejected");
	});

	it("throws on timeout when never done", async () => {
		await expect(
			pollUntil({
				intervalMs: 1,
				timeoutMs: 0,
				poll: async () => ({ status: "pending" }),
			}),
		).rejects.toThrow("timed out");
	});
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm -F server exec vitest run src/controllers/transcription/providers/poll.test.ts`
Expected: FAIL — cannot find module `./poll`.

- [ ] **Step 3: Implement `poll.ts`**

```ts
type PollState<T> =
	| { status: "pending" }
	| { status: "done"; value: T }
	| { status: "error"; error?: string };

/**
 * Poll an async job until it reports done, errors, or the timeout elapses.
 * `poll` is called immediately, then every `intervalMs` until the deadline.
 */
export async function pollUntil<T>(opts: {
	poll: () => Promise<PollState<T>>;
	intervalMs: number;
	timeoutMs: number;
}): Promise<T> {
	const deadline = Date.now() + opts.timeoutMs;
	while (true) {
		const state = await opts.poll();
		if (state.status === "done") return state.value;
		if (state.status === "error")
			throw new Error(state.error ?? "transcription job failed");
		if (Date.now() >= deadline) throw new Error("transcription timed out");
		await new Promise((resolve) => setTimeout(resolve, opts.intervalMs));
	}
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm -F server exec vitest run src/controllers/transcription/providers/poll.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/controllers/transcription/providers/poll.ts apps/server/src/controllers/transcription/providers/poll.test.ts
git commit -m "feat(genesis-173): add bounded poll helper for async STT providers"
```

---

## Task 4: Provider result type + move Deepgram into a provider module

**Files:**
- Create: `apps/server/src/controllers/transcription/providers/types.ts`
- Create: `apps/server/src/controllers/transcription/providers/deepgram.ts`

- [ ] **Step 1: Create the shared result type**

`providers/types.ts`:

```ts
export type ProviderResult = {
	transcript: string;
	confidence: number | null;
	durationSec: number | null;
	model: string;
};

export type ProviderFn = (file: File) => Promise<ProviderResult>;
```

- [ ] **Step 2: Move the existing Deepgram logic into `providers/deepgram.ts`**

```ts
import { ORPCError } from "@orpc/server";
import { env } from "../../../utils/env";
import { logger } from "../../../utils/logger";
import type { ProviderResult } from "./types";

const DEEPGRAM_MODEL = "nova-3";
const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";

type DeepgramResponse = {
	metadata?: { duration?: number };
	results?: {
		channels?: Array<{
			alternatives?: Array<{ transcript?: string; confidence?: number }>;
		}>;
	};
};

export async function transcribeDeepgram(file: File): Promise<ProviderResult> {
	if (!env.DEEPGRAM_API_KEY) {
		throw new Error(
			"Deepgram not configured. Set DEEPGRAM_API_KEY to enable transcription.",
		);
	}

	const params = new URLSearchParams({
		model: DEEPGRAM_MODEL,
		smart_format: "true",
		punctuate: "true",
	});
	const arrayBuffer = await file.arrayBuffer();

	let response: Response;
	try {
		response = await fetch(`${DEEPGRAM_URL}?${params.toString()}`, {
			method: "POST",
			headers: {
				Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
				"Content-Type": file.type || "audio/wav",
			},
			body: Buffer.from(arrayBuffer),
		});
	} catch (err) {
		logger.error({ err }, "Deepgram request failed to send");
		throw new ORPCError("BAD_GATEWAY", {
			message: "Transcription service unreachable",
		});
	}

	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		logger.error(
			{ status: response.status, detail },
			"Deepgram returned an error",
		);
		throw new ORPCError("BAD_GATEWAY", { message: "Transcription failed" });
	}

	const data = (await response.json()) as DeepgramResponse;
	const alternative = data.results?.channels?.[0]?.alternatives?.[0];

	return {
		transcript: alternative?.transcript ?? "",
		confidence: alternative?.confidence ?? null,
		durationSec: data.metadata?.duration ?? null,
		model: DEEPGRAM_MODEL,
	};
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm check-types`
Expected: PASS (the old `transcription.service.ts` still exists and works; we rewrite it in Task 8).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/controllers/transcription/providers/types.ts apps/server/src/controllers/transcription/providers/deepgram.ts
git commit -m "refactor(genesis-173): extract deepgram into a provider module"
```

---

## Task 5: OpenAI provider (gpt-4o + mini)

**Files:**
- Create: `apps/server/src/controllers/transcription/providers/openai.ts`

- [ ] **Step 1: Implement `openai.ts`**

```ts
import { ORPCError } from "@orpc/server";
import { env } from "../../../utils/env";
import { logger } from "../../../utils/logger";
import type { ProviderResult } from "./types";

type OpenaiModel = "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";

/**
 * OpenAI is synchronous: multipart POST returns the transcript in `text`.
 * These GPT-4o models support only json/text response formats — no confidence
 * or duration is returned, so both are null.
 */
export async function transcribeOpenai(
	file: File,
	model: OpenaiModel,
): Promise<ProviderResult> {
	if (!env.OPENAI_API_KEY) {
		throw new Error("OpenAI not configured. Set OPENAI_API_KEY.");
	}

	const form = new FormData();
	form.append("file", file, file.name || "audio.wav");
	form.append("model", model);
	form.append("response_format", "json");

	let response: Response;
	try {
		response = await fetch(OPENAI_URL, {
			method: "POST",
			// Do NOT set Content-Type — fetch sets the multipart boundary.
			headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
			body: form,
		});
	} catch (err) {
		logger.error({ err }, "OpenAI request failed to send");
		throw new ORPCError("BAD_GATEWAY", {
			message: "Transcription service unreachable",
		});
	}

	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		logger.error(
			{ status: response.status, detail },
			"OpenAI returned an error",
		);
		throw new ORPCError("BAD_GATEWAY", { message: "Transcription failed" });
	}

	const data = (await response.json()) as { text?: string };
	return {
		transcript: data.text ?? "",
		confidence: null,
		durationSec: null,
		model,
	};
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm check-types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/controllers/transcription/providers/openai.ts
git commit -m "feat(genesis-173): add OpenAI gpt-4o transcription provider"
```

---

## Task 6: AssemblyAI provider (async upload → poll)

**Files:**
- Create: `apps/server/src/controllers/transcription/providers/assemblyai.ts`

- [ ] **Step 1: Implement `assemblyai.ts`**

```ts
import { ORPCError } from "@orpc/server";
import { env } from "../../../utils/env";
import { logger } from "../../../utils/logger";
import { pollUntil } from "./poll";
import type { ProviderResult } from "./types";

const BASE = "https://api.assemblyai.com/v2";
const MODEL = "universal-3-pro";

type CompletedTranscript = {
	text?: string;
	confidence?: number;
	audio_duration?: number;
};

/**
 * AssemblyAI is async: upload raw bytes -> create a transcript job -> poll until
 * completed. Auth uses the raw key (no "Bearer"). Universal-3 Pro is selected via
 * the `speech_models` array, with universal-2 as a language fallback.
 */
export async function transcribeAssemblyai(file: File): Promise<ProviderResult> {
	const key = env.ASSEMBLYAI_API_KEY;
	if (!key) throw new Error("AssemblyAI not configured. Set ASSEMBLYAI_API_KEY.");

	try {
		const bytes = Buffer.from(await file.arrayBuffer());

		const uploadRes = await fetch(`${BASE}/upload`, {
			method: "POST",
			headers: { authorization: key, "content-type": "application/octet-stream" },
			body: bytes,
		});
		if (!uploadRes.ok) throw new Error(`upload ${uploadRes.status}`);
		const { upload_url } = (await uploadRes.json()) as { upload_url: string };

		const createRes = await fetch(`${BASE}/transcript`, {
			method: "POST",
			headers: { authorization: key, "content-type": "application/json" },
			body: JSON.stringify({
				audio_url: upload_url,
				speech_models: ["universal-3-pro", "universal-2"],
			}),
		});
		if (!createRes.ok) throw new Error(`create ${createRes.status}`);
		const { id } = (await createRes.json()) as { id: string };

		const completed = await pollUntil<CompletedTranscript>({
			intervalMs: 2000,
			timeoutMs: 5 * 60 * 1000,
			poll: async () => {
				const res = await fetch(`${BASE}/transcript/${id}`, {
					headers: { authorization: key },
				});
				if (!res.ok) throw new Error(`poll ${res.status}`);
				const body = (await res.json()) as CompletedTranscript & {
					status: string;
					error?: string;
				};
				if (body.status === "completed") return { status: "done", value: body };
				if (body.status === "error")
					return { status: "error", error: body.error };
				return { status: "pending" };
			},
		});

		return {
			transcript: completed.text ?? "",
			confidence: completed.confidence ?? null,
			durationSec: completed.audio_duration ?? null,
			model: MODEL,
		};
	} catch (err) {
		logger.error({ err }, "AssemblyAI transcription failed");
		throw new ORPCError("BAD_GATEWAY", { message: "Transcription failed" });
	}
}
```

- [ ] **Step 2: Type-check + commit**

Run: `pnpm check-types` → PASS

```bash
git add apps/server/src/controllers/transcription/providers/assemblyai.ts
git commit -m "feat(genesis-173): add AssemblyAI Universal-3 Pro provider"
```

---

## Task 7: Speechmatics provider (async job → poll → fetch)

**Files:**
- Create: `apps/server/src/controllers/transcription/providers/speechmatics.ts`

- [ ] **Step 1: Implement `speechmatics.ts`**

```ts
import { ORPCError } from "@orpc/server";
import { env } from "../../../utils/env";
import { logger } from "../../../utils/logger";
import { pollUntil } from "./poll";
import type { ProviderResult } from "./types";

const BASE = "https://asr.api.speechmatics.com/v2";
const MODEL = "enhanced";

type ResultItem = {
	type?: string;
	alternatives?: Array<{ content?: string; confidence?: number }>;
};

/** Reassemble json-v2 results: words are space-separated, punctuation attaches with no leading space. */
function assembleTranscript(results: ResultItem[]): string {
	let out = "";
	for (const item of results) {
		const content = item.alternatives?.[0]?.content ?? "";
		if (!content) continue;
		out += item.type === "punctuation" ? content : (out ? " " : "") + content;
	}
	return out;
}

function averageConfidence(results: ResultItem[]): number | null {
	const confidences = results
		.map((r) => r.alternatives?.[0]?.confidence)
		.filter((c): c is number => typeof c === "number");
	if (confidences.length === 0) return null;
	return confidences.reduce((a, b) => a + b, 0) / confidences.length;
}

/**
 * Speechmatics is async: create a batch job (multipart audio + config), poll the
 * job until done, then fetch the json-v2 transcript. Confidence is per-item, so we
 * report the mean.
 */
export async function transcribeSpeechmatics(
	file: File,
): Promise<ProviderResult> {
	const key = env.SPEECHMATICS_API_KEY;
	if (!key) throw new Error("Speechmatics not configured. Set SPEECHMATICS_API_KEY.");

	try {
		const form = new FormData();
		form.append("data_file", file, file.name || "audio.wav");
		form.append(
			"config",
			JSON.stringify({
				type: "transcription",
				transcription_config: { language: "en", operating_point: "enhanced" },
			}),
		);

		const createRes = await fetch(`${BASE}/jobs`, {
			method: "POST",
			headers: { Authorization: `Bearer ${key}` },
			body: form,
		});
		if (!createRes.ok) throw new Error(`create ${createRes.status}`);
		const created = (await createRes.json()) as {
			id?: string;
			job?: { id?: string };
		};
		const jobId = created.id ?? created.job?.id;
		if (!jobId) throw new Error("speechmatics: no job id in create response");

		await pollUntil<true>({
			intervalMs: 3000,
			timeoutMs: 5 * 60 * 1000,
			poll: async () => {
				const res = await fetch(`${BASE}/jobs/${jobId}`, {
					headers: { Authorization: `Bearer ${key}` },
				});
				if (!res.ok) throw new Error(`poll ${res.status}`);
				const { job } = (await res.json()) as { job: { status: string } };
				if (job.status === "done") return { status: "done", value: true };
				if (job.status === "rejected")
					return { status: "error", error: "job rejected" };
				return { status: "pending" };
			},
		});

		const transcriptRes = await fetch(
			`${BASE}/jobs/${jobId}/transcript?format=json-v2`,
			{ headers: { Authorization: `Bearer ${key}` } },
		);
		if (!transcriptRes.ok) throw new Error(`transcript ${transcriptRes.status}`);
		const data = (await transcriptRes.json()) as {
			results?: ResultItem[];
			job?: { duration?: number };
		};
		const results = data.results ?? [];

		return {
			transcript: assembleTranscript(results),
			confidence: averageConfidence(results),
			durationSec: data.job?.duration ?? null,
			model: MODEL,
		};
	} catch (err) {
		logger.error({ err }, "Speechmatics transcription failed");
		throw new ORPCError("BAD_GATEWAY", { message: "Transcription failed" });
	}
}
```

- [ ] **Step 2: Type-check + commit**

Run: `pnpm check-types` → PASS

```bash
git add apps/server/src/controllers/transcription/providers/speechmatics.ts
git commit -m "feat(genesis-173): add Speechmatics enhanced provider"
```

---

## Task 8: Service dispatch (TDD) + controller wiring

**Files:**
- Rewrite: `apps/server/src/controllers/transcription/transcription.service.ts`
- Create: `apps/server/src/controllers/transcription/transcription.service.test.ts`
- Modify: `apps/server/src/controllers/transcription/transcription.controller.ts`

- [ ] **Step 1: Write the failing dispatch test**

`transcription.service.test.ts`:

```ts
import { MAX_FILE_SIZE_BYTES } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./providers/deepgram", () => ({ transcribeDeepgram: vi.fn() }));
vi.mock("./providers/openai", () => ({ transcribeOpenai: vi.fn() }));
vi.mock("./providers/assemblyai", () => ({ transcribeAssemblyai: vi.fn() }));
vi.mock("./providers/speechmatics", () => ({ transcribeSpeechmatics: vi.fn() }));

import { transcribeAssemblyai } from "./providers/assemblyai";
import { transcribeDeepgram } from "./providers/deepgram";
import { transcribeOpenai } from "./providers/openai";
import { transcribeAudio } from "./transcription.service";

const smallFile = { size: 1000, type: "audio/wav" } as File;
const result = {
	transcript: "hi",
	confidence: 0.9,
	durationSec: 1,
	model: "nova-3",
};

describe("transcribeAudio dispatch", () => {
	beforeEach(() => vi.clearAllMocks());

	it("routes deepgram and attaches the provider", async () => {
		vi.mocked(transcribeDeepgram).mockResolvedValue(result);
		const out = await transcribeAudio(smallFile, "deepgram");
		expect(transcribeDeepgram).toHaveBeenCalledWith(smallFile);
		expect(out).toEqual({ ...result, provider: "deepgram" });
	});

	it("routes assemblyai", async () => {
		vi.mocked(transcribeAssemblyai).mockResolvedValue({
			...result,
			model: "universal-3-pro",
		});
		const out = await transcribeAudio(smallFile, "assemblyai");
		expect(out.provider).toBe("assemblyai");
		expect(out.model).toBe("universal-3-pro");
	});

	it("maps the two openai keys to the right model arg", async () => {
		vi.mocked(transcribeOpenai).mockResolvedValue({
			...result,
			model: "gpt-4o-mini-transcribe",
		});
		await transcribeAudio(smallFile, "openai-gpt4o-mini");
		expect(transcribeOpenai).toHaveBeenCalledWith(
			smallFile,
			"gpt-4o-mini-transcribe",
		);
	});

	it("rejects oversize files before dispatching", async () => {
		const big = { size: MAX_FILE_SIZE_BYTES + 1, type: "audio/wav" } as File;
		await expect(transcribeAudio(big, "deepgram")).rejects.toMatchObject({
			code: "PAYLOAD_TOO_LARGE",
		});
		expect(transcribeDeepgram).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm -F server exec vitest run src/controllers/transcription/transcription.service.test.ts`
Expected: FAIL — `transcribeAudio` signature/exports don't match yet.

- [ ] **Step 3: Rewrite `transcription.service.ts` as the dispatch**

```ts
import { ORPCError } from "@orpc/server";
import { MAX_FILE_SIZE_BYTES, type TranscriptionProvider } from "@repo/shared";
import { transcribeAssemblyai } from "./providers/assemblyai";
import { transcribeDeepgram } from "./providers/deepgram";
import { transcribeOpenai } from "./providers/openai";
import { transcribeSpeechmatics } from "./providers/speechmatics";
import type { ProviderResult } from "./providers/types";

const DISPATCH: Record<
	TranscriptionProvider,
	(file: File) => Promise<ProviderResult>
> = {
	deepgram: transcribeDeepgram,
	assemblyai: transcribeAssemblyai,
	"openai-gpt4o": (file) => transcribeOpenai(file, "gpt-4o-transcribe"),
	"openai-gpt4o-mini": (file) => transcribeOpenai(file, "gpt-4o-mini-transcribe"),
	speechmatics: transcribeSpeechmatics,
};

/**
 * Transcribe an audio clip with the chosen cloud provider. The size guard runs once
 * here; each provider module owns its own API call and error mapping.
 */
export async function transcribeAudio(
	file: File,
	provider: TranscriptionProvider,
) {
	if (file.size > MAX_FILE_SIZE_BYTES) {
		throw new ORPCError("PAYLOAD_TOO_LARGE", {
			message: `Audio too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
		});
	}

	const result = await DISPATCH[provider](file);
	return { ...result, provider };
}
```

- [ ] **Step 4: Update the controller to pass the provider**

`transcription.controller.ts`:

```ts
import { protectedProcedure } from "../../orpc/procedures";
import { transcribeAudio } from "./transcription.service";

export const transcriptionController = {
	transcribeAudio: protectedProcedure.transcription.transcribeAudio.handler(
		async ({ input }) => {
			return transcribeAudio(input.file, input.provider);
		},
	),
};
```

- [ ] **Step 5: Run tests, verify pass**

Run: `pnpm -F server exec vitest run src/controllers/transcription/`
Expected: PASS (dispatch tests + poll tests).

- [ ] **Step 6: Full server unit suite stays green**

Run: `pnpm test:server:unit`
Expected: PASS (previous 51 + new tests).

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/controllers/transcription/transcription.service.ts apps/server/src/controllers/transcription/transcription.service.test.ts apps/server/src/controllers/transcription/transcription.controller.ts
git commit -m "feat(genesis-173): dispatch transcription across cloud providers"
```

---

## Task 9: Mobile — expose raw oRPC client + per-provider call helper

**Files:**
- Modify: `apps/mobile/src/utils/orpc.ts`
- Rewrite: `apps/mobile/src/api/transcription.api.ts`

- [ ] **Step 1: Export the raw client**

In `apps/mobile/src/utils/orpc.ts`, change the client declaration to export it:

```ts
export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
```

- [ ] **Step 2: Rewrite `transcription.api.ts` to a direct call helper**

```ts
import type { TranscriptionProvider } from "@repo/shared";
import { client } from "../utils/orpc";

/**
 * Call the transcription endpoint for a single provider. The Speech screen fires one
 * of these per provider in parallel, so we use the raw client (not a TanStack mutation
 * with shared state) to keep each result independent.
 */
export function transcribeAudioWith(file: File, provider: TranscriptionProvider) {
	return client.transcription.transcribeAudio({ file, provider });
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm -F mobile exec tsc --noEmit`
Expected: PASS (note: `speech-lab.tsx` still imports the removed `useTranscribeAudio` — it will error until Task 10. If running tsc standalone here errors only on that import, that's expected; proceed to Task 10 and re-check.)

- [ ] **Step 4: Commit (with Task 10, since speech-lab depends on it)** — defer commit to Task 10.

---

## Task 10: Mobile — "Run all engines" + result cards

**Files:**
- Modify: `apps/mobile/src/app/(portal)/(tabs)/speech-lab.tsx`

- [ ] **Step 1: Swap the import**

Replace:

```ts
import { useTranscribeAudio } from "../../../api/transcription.api";
```

with:

```ts
import type { TranscriptionProvider } from "@repo/shared";
import { transcribeAudioWith } from "../../../api/transcription.api";
import type { TranscribeAudioResult } from "@repo/shared";
```

- [ ] **Step 2: Add the provider list + run state types (module scope, after `uriToBlob`)**

```ts
const PROVIDERS: { key: TranscriptionProvider; label: string }[] = [
	{ key: "deepgram", label: "Deepgram Nova-3" },
	{ key: "assemblyai", label: "AssemblyAI Universal-3 Pro" },
	{ key: "openai-gpt4o", label: "OpenAI gpt-4o-transcribe" },
	{ key: "openai-gpt4o-mini", label: "OpenAI gpt-4o-mini" },
	{ key: "speechmatics", label: "Speechmatics Enhanced" },
];

type RunState = {
	status: "pending" | "done" | "error";
	latencyMs?: number;
	result?: TranscribeAudioResult;
	error?: string;
};
```

- [ ] **Step 3: Replace the cloud state + mutation**

Remove:

```ts
	const [cloudMsg, setCloudMsg] = useState<string | null>(null);
```
```ts
	const cloud = useTranscribeAudio();
```

Add (next to the other `useState` hooks):

```ts
	const [runs, setRuns] = useState<Record<string, RunState> | null>(null);
	const [running, setRunning] = useState(false);
```

- [ ] **Step 4: Replace `transcribeCloud` with `runAll`**

Delete the entire `transcribeCloud` function and add:

```ts
	// Fan out: transcribe the current clip with every engine in parallel, each result
	// landing independently so cards fill in as engines finish.
	async function runAll() {
		if (!recordedUri) return;
		setError(null);
		setRunning(true);
		setRuns(
			Object.fromEntries(PROVIDERS.map((p) => [p.key, { status: "pending" }])),
		);
		try {
			const ext = recordedUri.split(".").pop()?.toLowerCase() ?? "wav";
			const type =
				pickedType ??
				(ext === "caf"
					? "audio/x-caf"
					: ext === "m4a"
						? "audio/mp4"
						: "audio/wav");
			const raw = await uriToBlob(recordedUri);
			const blob = raw.type ? raw : raw.slice(0, raw.size, type);
			const file = Object.assign(blob, {
				name: `audio.${ext}`,
			}) as unknown as File;

			await Promise.allSettled(
				PROVIDERS.map(async ({ key }) => {
					const startedAt = Date.now();
					try {
						const result = await transcribeAudioWith(file, key);
						setRuns((prev) => ({
							...prev,
							[key]: { status: "done", latencyMs: Date.now() - startedAt, result },
						}));
					} catch (e) {
						setRuns((prev) => ({
							...prev,
							[key]: {
								status: "error",
								latencyMs: Date.now() - startedAt,
								error: e instanceof Error ? e.message : "failed",
							},
						}));
					}
				}),
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not read the clip");
		} finally {
			setRunning(false);
		}
	}
```

- [ ] **Step 5: Replace the cloud button + cloudMsg block in the JSX**

Find the "Audio clip" card's transcribe button + `cloudMsg` text (the `Button` labelled "Transcribe via Deepgram (cloud)" and the `{cloudMsg ? ... : null}` block) and replace them with:

```tsx
					<Button onPress={runAll} loading={running} disabled={running}>
						Run all engines
					</Button>
```

Then, after the "Audio clip" card (before the editable transcript `View`), add the results list:

```tsx
				{runs ? (
					<View className="gap-2">
						<Text className="text-muted-foreground text-xs uppercase">
							Engine comparison
						</Text>
						{PROVIDERS.map(({ key, label }) => {
							const run = runs[key];
							return (
								<View
									key={key}
									className="gap-1 rounded-md border border-border p-3"
								>
									<View className="flex-row items-center justify-between">
										<Text className="font-medium text-foreground text-sm">
											{label}
										</Text>
										<Text className="text-muted-foreground text-xs">
											{run?.status === "pending"
												? "…"
												: run?.latencyMs != null
													? `${(run.latencyMs / 1000).toFixed(1)}s`
													: ""}
										</Text>
									</View>
									{run?.status === "done" && run.result ? (
										<>
											<Text className="text-muted-foreground text-xs">
												{run.result.model}
												{run.result.confidence != null
													? ` · ${Math.round(run.result.confidence * 100)}% conf`
													: ""}
											</Text>
											<Text className="text-foreground text-sm" selectable>
												{run.result.transcript || "(empty)"}
											</Text>
										</>
									) : run?.status === "error" ? (
										<Text className="text-destructive text-xs" selectable>
											{run.error}
										</Text>
									) : (
										<Text className="text-muted-foreground text-sm">
											Transcribing…
										</Text>
									)}
								</View>
							);
						})}
					</View>
				) : null}
```

- [ ] **Step 6: Clear runs on new recording / pick / clear**

In `start()`, `pickAudio()`, and `clearAll()`, add `setRuns(null);` next to the existing `setRecordedUri(...)` / reset lines.

- [ ] **Step 7: Lint + type-check**

Run: `pnpm biome check --write "apps/mobile/src/app/(portal)/(tabs)/speech-lab.tsx" "apps/mobile/src/api/transcription.api.ts" "apps/mobile/src/utils/orpc.ts"`
Run: `pnpm -F mobile exec tsc --noEmit`
Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/utils/orpc.ts apps/mobile/src/api/transcription.api.ts "apps/mobile/src/app/(portal)/(tabs)/speech-lab.tsx"
git commit -m "feat(genesis-173): run-all engine comparison in speech lab"
```

---

## Task 11: Full verification + live device test

- [ ] **Step 1: Monorepo checks**

Run: `pnpm check-types` → PASS
Run: `pnpm check` → PASS (Biome; if a fresh `apps/mobile/android` exists from a prior prebuild, ignore its noise per the known gotcha)
Run: `pnpm build` → PASS
Run: `pnpm test:server:unit` → PASS

- [ ] **Step 2: Add keys + restart server**

Add `ASSEMBLYAI_API_KEY`, `OPENAI_API_KEY`, `SPEECHMATICS_API_KEY` to `apps/server/.env`, then restart the server (kill the process on :3000, `pnpm dev:server`). Confirm clean boot (env validation passes).

- [ ] **Step 3: Live test on device**

In the Speech tab: record or pick a clip → **Run all engines**. Confirm five cards fill in, each with latency, and that engines with valid keys show transcripts (and confidence where the engine provides it). Note any engine returning an error and check the server log for the upstream status/detail.

- [ ] **Step 4: Capture results in the experiment journal**

Append a "Provider comparison results" section to `docs/engineering/experiments/audio-transcription-on-device.md`: per-engine transcript quality, latency, and confidence on the test clips, plus a recommendation.

---

## Self-Review

- **Spec coverage:** provider enum + input/result (Task 1 ✓); env keys (Task 2 ✓); provider dispatch + modules incl. async poll (Tasks 3–8 ✓); error handling mirrors Deepgram pattern, missing key → Error, upstream → BAD_GATEWAY (Tasks 4–7 ✓); oversize guard (Task 8 ✓); mobile fan-out + result cards + latency + on-device path untouched (Tasks 9–10 ✓); verification incl. dispatch + poll unit tests and live test (Tasks 8, 11 ✓); Google Chirp / streaming out of scope (not built ✓).
- **Placeholders:** none — every code step is complete; the only judgment step is the env.ts `runtimeEnv` mirror (Task 2 Step 1), which is conditioned on inspecting the existing `DEEPGRAM_API_KEY` handling.
- **Type consistency:** `ProviderResult` (transcript/confidence/durationSec/model) is returned by every provider; the service adds `provider`; `TranscribeAudioResultSchema` matches (those five fields). `transcribeAudioWith(file, provider)` matches the client call and the mobile usage. `pollUntil` `PollState` shape is consistent across both async providers and its test.
