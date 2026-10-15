# Streaming (Live) Cloud STT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live, as-you-speak transcription in the mobile app, streaming one mic input to Deepgram Nova-3 and AssemblyAI v3 simultaneously for a side-by-side comparison.

**Architecture:** Device captures PCM via `expo-audio`'s `useAudioStream`; the app fetches a short-lived token from our server (authed oRPC) per provider, then opens a WebSocket directly to each provider (key never leaves the server, audio never transits our server). Each provider's interim/final transcripts render in its own live pane.

**Tech Stack:** expo-audio `useAudioStream` (int16/16kHz/mono PCM), React Native `WebSocket`, oRPC + Express (token mint), Zod (`@repo/shared`), Vitest (server unit test).

## Global Constraints

- Biome formatting: **tab indentation, double quotes**. A pre-commit hook auto-formats staged files.
- Mobile: relative imports within `src/`, `@repo/*` for workspace packages; **no `@/` alias**. Use `WebSocket` (RN global) — it CANNOT set HTTP headers.
- Server: oRPC two-layer (controller → service); `protectedProcedure` for authed endpoints; `logger` from `utils/logger` (never `console.log`); throw `ORPCError` for client-facing errors, plain `Error` for missing-config (becomes 500, not leaked).
- **No new env vars** — reuse existing `DEEPGRAM_API_KEY` and `ASSEMBLYAI_API_KEY` (already in `apps/server/src/utils/env.ts`).
- PCM/WS params must match exactly: **int16 / 16000 Hz / mono / linear16 (Deepgram) / pcm_s16le (AssemblyAI)**.
- Audio chunking: batch PCM to ~100 ms (≈3200 bytes at 16 kHz int16 mono) before sending — AssemblyAI requires 50–1000 ms chunks; Deepgram accepts any size.

## Verified provider APIs (2026-06-19, official docs)

- **Deepgram token:** `POST https://api.deepgram.com/v1/auth/grant`, header `Authorization: Token <KEY>`, body `{"ttl_seconds":60}` → `{ "access_token": string, "expires_in": number }`.
- **Deepgram WS:** `wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true`; auth `new WebSocket(url, ["token", accessToken])`; send binary PCM; results `{type:"Results", is_final, channel.alternatives[0].transcript}`; control text JSON `{"type":"KeepAlive"}`, `{"type":"CloseStream"}`.
- **AssemblyAI token:** `GET https://streaming.assemblyai.com/v3/token?expires_in_seconds=60`, header `Authorization: <KEY>` (no "Bearer") → `{ "token": string, "expires_in_seconds": number }`.
- **AssemblyAI WS:** `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&encoding=pcm_s16le&format_turns=true&token=<TOKEN>`; send binary PCM; messages `{type:"Begin"}`, `{type:"Turn", transcript, end_of_turn, turn_is_formatted}`, `{type:"Termination"}`; close via `{"type":"Terminate"}`.

---

## Setup (run once, before Task 1)

Work in the worktree: `/Users/mujahidali/Documents/project-genesis-2.0/.claude/worktrees/genesis-streaming` (branch `genesis-173-audio-transcription`).

- [ ] Install deps in the worktree: `pnpm install` (worktrees don't share `node_modules`).
- [ ] Verify the streaming API is in the installed module:
  `grep -rl "useAudioStream" .claude/worktrees/genesis-streaming/apps/mobile/node_modules/expo-audio/build` — expect a hit. If absent, stop and report (the design assumes 56.0.11 exposes it).
- [ ] Note for Task 7: the existing dev client was built with this same `expo-audio` 56.0.11, so the native `AudioStream` code should already be present (no rebuild). If the device test errors with "native module AudioStream not found," a one-time `npx expo run:android` rebuild is required.

---

## File Structure

- `packages/shared/src/models/transcription.types.ts` — **modify**: add `StreamProviderSchema`, `StreamTokenInputSchema`, `StreamTokenResultSchema` + types.
- `packages/orpc-contracts/src/contracts/transcription.contract.ts` — **modify**: add `streamToken`.
- `apps/server/src/controllers/transcription/providers/stream-tokens.ts` — **create**: `mintDeepgramToken`, `mintAssemblyaiToken`.
- `apps/server/src/controllers/transcription/transcription.service.ts` — **modify**: add `getStreamToken(provider)`.
- `apps/server/src/controllers/transcription/transcription.controller.ts` — **modify**: add `streamToken` handler.
- `apps/server/src/controllers/transcription/stream-token.service.test.ts` — **create**: dispatch test.
- `apps/mobile/src/streaming/types.ts` — **create**: `StreamEvent`, `StreamingSession`, `OpenStream`.
- `apps/mobile/src/streaming/deepgram-stream.ts` — **create**: `openDeepgramStream`.
- `apps/mobile/src/streaming/assemblyai-stream.ts` — **create**: `openAssemblyaiStream`.
- `apps/mobile/src/api/transcription.api.ts` — **modify**: add `getStreamToken`.
- `apps/mobile/src/app/(portal)/(tabs)/speech-lab.tsx` — **modify**: add "Live" mode.

---

## Task 1: Shared schemas + contract

**Files:**
- Modify: `packages/shared/src/models/transcription.types.ts`
- Modify: `packages/orpc-contracts/src/contracts/transcription.contract.ts`

**Interfaces produced:** `StreamProviderSchema` (`"deepgram"|"assemblyai"`), `StreamTokenInput = { provider }`, `StreamTokenResult = { provider, token: string, expiresInSec: number }`; contract method `transcription.streamToken`.

- [ ] **Step 1: Add schemas** — append to `transcription.types.ts`:

```ts
export const StreamProviderSchema = z.enum(["deepgram", "assemblyai"]);
export type StreamProvider = z.infer<typeof StreamProviderSchema>;

export const StreamTokenInputSchema = z.object({
	provider: StreamProviderSchema,
});
export type StreamTokenInput = z.infer<typeof StreamTokenInputSchema>;

export const StreamTokenResultSchema = z.object({
	provider: StreamProviderSchema,
	token: z.string(),
	expiresInSec: z.number(),
});
export type StreamTokenResult = z.infer<typeof StreamTokenResultSchema>;
```

- [ ] **Step 2: Add contract method** — in `transcription.contract.ts`, import the two schemas alongside the existing imports and add the method:

```ts
import {
	StreamTokenInputSchema,
	StreamTokenResultSchema,
	TranscribeAudioInputSchema,
	TranscribeAudioResultSchema,
} from "@repo/shared";

export const transcriptionContract = {
	transcribeAudio: oc
		.input(TranscribeAudioInputSchema)
		.output(TranscribeAudioResultSchema),
	streamToken: oc
		.input(StreamTokenInputSchema)
		.output(StreamTokenResultSchema),
};
```

- [ ] **Step 3: Type-check** — `pnpm check-types`. Expect a failure ONLY in `transcription.controller.ts` (the contract now has a `streamToken` method with no handler — oRPC requires all contract methods implemented). That's fixed in Task 2. If any OTHER error appears, stop and report.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/models/transcription.types.ts packages/orpc-contracts/src/contracts/transcription.contract.ts
git commit -m "feat(genesis-173): add streamToken contract + schemas"
```

---

## Task 2: Server token mint + service + controller (TDD)

**Files:**
- Create: `apps/server/src/controllers/transcription/providers/stream-tokens.ts`
- Modify: `apps/server/src/controllers/transcription/transcription.service.ts`
- Modify: `apps/server/src/controllers/transcription/transcription.controller.ts`
- Create: `apps/server/src/controllers/transcription/stream-token.service.test.ts`

**Interfaces consumed:** `StreamProvider` from `@repo/shared`. **Produced:** `getStreamToken(provider: StreamProvider): Promise<{ provider, token, expiresInSec }>`; `mintDeepgramToken()` / `mintAssemblyaiToken(): Promise<{ token: string; expiresInSec: number }>`.

- [ ] **Step 1: Create `providers/stream-tokens.ts`:**

```ts
import { ORPCError } from "@orpc/server";
import { env } from "../../../utils/env";
import { logger } from "../../../utils/logger";

type MintedToken = { token: string; expiresInSec: number };

/** Deepgram: short-lived JWT via POST /v1/auth/grant (key stays server-side). */
export async function mintDeepgramToken(): Promise<MintedToken> {
	if (!env.DEEPGRAM_API_KEY) {
		throw new Error("Deepgram not configured. Set DEEPGRAM_API_KEY.");
	}
	let response: Response;
	try {
		response = await fetch("https://api.deepgram.com/v1/auth/grant", {
			method: "POST",
			headers: {
				Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ ttl_seconds: 60 }),
		});
	} catch (err) {
		logger.error({ err }, "Deepgram token request failed to send");
		throw new ORPCError("BAD_GATEWAY", {
			message: "Streaming token service unreachable",
		});
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		logger.error({ status: response.status, detail }, "Deepgram token error");
		throw new ORPCError("BAD_GATEWAY", { message: "Could not get streaming token" });
	}
	const data = (await response.json()) as {
		access_token: string;
		expires_in: number;
	};
	return { token: data.access_token, expiresInSec: data.expires_in };
}

/** AssemblyAI: short-lived streaming token via GET /v3/token (key stays server-side). */
export async function mintAssemblyaiToken(): Promise<MintedToken> {
	if (!env.ASSEMBLYAI_API_KEY) {
		throw new Error("AssemblyAI not configured. Set ASSEMBLYAI_API_KEY.");
	}
	let response: Response;
	try {
		response = await fetch(
			"https://streaming.assemblyai.com/v3/token?expires_in_seconds=60",
			{ headers: { authorization: env.ASSEMBLYAI_API_KEY } },
		);
	} catch (err) {
		logger.error({ err }, "AssemblyAI token request failed to send");
		throw new ORPCError("BAD_GATEWAY", {
			message: "Streaming token service unreachable",
		});
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		logger.error({ status: response.status, detail }, "AssemblyAI token error");
		throw new ORPCError("BAD_GATEWAY", { message: "Could not get streaming token" });
	}
	const data = (await response.json()) as {
		token: string;
		expires_in_seconds: number;
	};
	return { token: data.token, expiresInSec: data.expires_in_seconds };
}
```

- [ ] **Step 2: Write the failing dispatch test** `stream-token.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./providers/stream-tokens", () => ({
	mintDeepgramToken: vi.fn(),
	mintAssemblyaiToken: vi.fn(),
}));

import { mintAssemblyaiToken, mintDeepgramToken } from "./providers/stream-tokens";
import { getStreamToken } from "./transcription.service";

describe("getStreamToken dispatch", () => {
	beforeEach(() => vi.clearAllMocks());

	it("routes deepgram and attaches the provider", async () => {
		vi.mocked(mintDeepgramToken).mockResolvedValue({
			token: "dg-token",
			expiresInSec: 60,
		});
		const out = await getStreamToken("deepgram");
		expect(mintDeepgramToken).toHaveBeenCalledOnce();
		expect(out).toEqual({ provider: "deepgram", token: "dg-token", expiresInSec: 60 });
	});

	it("routes assemblyai", async () => {
		vi.mocked(mintAssemblyaiToken).mockResolvedValue({
			token: "aai-token",
			expiresInSec: 60,
		});
		const out = await getStreamToken("assemblyai");
		expect(mintAssemblyaiToken).toHaveBeenCalledOnce();
		expect(out.provider).toBe("assemblyai");
		expect(out.token).toBe("aai-token");
	});
});
```

- [ ] **Step 3: Run it, verify it FAILS** — `pnpm -F server exec vitest run src/controllers/transcription/stream-token.service.test.ts` (fails: `getStreamToken` not exported).

- [ ] **Step 4: Add `getStreamToken` to `transcription.service.ts`** — add imports and the function (leave existing `transcribeAudio` untouched):

```ts
import type { StreamProvider } from "@repo/shared";
import {
	mintAssemblyaiToken,
	mintDeepgramToken,
} from "./providers/stream-tokens";

const STREAM_TOKEN: Record<
	StreamProvider,
	() => Promise<{ token: string; expiresInSec: number }>
> = {
	deepgram: mintDeepgramToken,
	assemblyai: mintAssemblyaiToken,
};

export async function getStreamToken(provider: StreamProvider) {
	const minted = await STREAM_TOKEN[provider]();
	return { provider, ...minted };
}
```

- [ ] **Step 5: Add the controller handler** — in `transcription.controller.ts`, import `getStreamToken` and add the method:

```ts
import { getStreamToken, transcribeAudio } from "./transcription.service";

export const transcriptionController = {
	transcribeAudio: protectedProcedure.transcription.transcribeAudio.handler(
		async ({ input }) => {
			return transcribeAudio(input.file, input.provider);
		},
	),
	streamToken: protectedProcedure.transcription.streamToken.handler(
		async ({ input }) => {
			return getStreamToken(input.provider);
		},
	),
};
```

- [ ] **Step 6: Run tests + types** — `pnpm -F server exec vitest run src/controllers/transcription/` (all pass), then `pnpm check-types` (server now green; the Task-1 controller error is resolved). `pnpm test:server:unit` stays green.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/controllers/transcription/providers/stream-tokens.ts apps/server/src/controllers/transcription/transcription.service.ts apps/server/src/controllers/transcription/transcription.controller.ts apps/server/src/controllers/transcription/stream-token.service.test.ts
git commit -m "feat(genesis-173): mint short-lived streaming tokens (deepgram + assemblyai)"
```

---

## Task 3: Mobile streaming types

**Files:**
- Create: `apps/mobile/src/streaming/types.ts`

**Interfaces produced:** `StreamEvent`, `StreamingSession`, `OpenStream`.

- [ ] **Step 1: Create `types.ts`:**

```ts
export type StreamEvent =
	| { type: "open" }
	| { type: "partial"; text: string }
	| { type: "final"; text: string }
	| { type: "error"; message: string }
	| { type: "closed" };

export type StreamingSession = {
	/** Send one binary PCM frame (int16 LE, 16 kHz mono). */
	sendPcm: (data: ArrayBuffer) => void;
	/** Finalize and close the socket. */
	close: () => void;
};

export type OpenStream = (opts: {
	token: string;
	onEvent: (event: StreamEvent) => void;
}) => StreamingSession;
```

- [ ] **Step 2: Type-check** — `pnpm -F mobile exec tsc --noEmit` (no errors in this file; speech-lab unaffected yet).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/streaming/types.ts
git commit -m "feat(genesis-173): add streaming session types"
```

---

## Task 4: Deepgram streaming client

**Files:**
- Create: `apps/mobile/src/streaming/deepgram-stream.ts`

**Interfaces consumed:** `OpenStream`, `StreamingSession`, `StreamEvent` from `./types`. **Produced:** `openDeepgramStream: OpenStream`.

- [ ] **Step 1: Create `deepgram-stream.ts`:**

```ts
import type { OpenStream } from "./types";

const URL =
	"wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true";

// Deepgram authenticates header-less clients via the Sec-WebSocket-Protocol subprotocol.
export const openDeepgramStream: OpenStream = ({ token, onEvent }) => {
	const ws = new WebSocket(URL, ["token", token]);
	ws.binaryType = "arraybuffer";
	let keepAlive: ReturnType<typeof setInterval> | undefined;

	ws.onopen = () => {
		onEvent({ type: "open" });
		// Text control frames keep the socket alive during silence.
		keepAlive = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: "KeepAlive" }));
			}
		}, 8000);
	};
	ws.onmessage = (e) => {
		const msg = JSON.parse(e.data as string) as {
			type?: string;
			is_final?: boolean;
			channel?: { alternatives?: Array<{ transcript?: string }> };
		};
		if (msg.type !== "Results") return;
		const text = msg.channel?.alternatives?.[0]?.transcript ?? "";
		if (!text) return;
		onEvent({ type: msg.is_final ? "final" : "partial", text });
	};
	ws.onerror = () => onEvent({ type: "error", message: "Deepgram connection error" });
	ws.onclose = () => {
		if (keepAlive) clearInterval(keepAlive);
		onEvent({ type: "closed" });
	};

	return {
		sendPcm: (data) => {
			if (ws.readyState === WebSocket.OPEN) ws.send(data);
		},
		close: () => {
			if (keepAlive) clearInterval(keepAlive);
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: "CloseStream" }));
			}
			ws.close();
		},
	};
};
```

- [ ] **Step 2: Type-check** — `pnpm -F mobile exec tsc --noEmit` (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/streaming/deepgram-stream.ts
git commit -m "feat(genesis-173): add Deepgram live streaming client"
```

---

## Task 5: AssemblyAI streaming client

**Files:**
- Create: `apps/mobile/src/streaming/assemblyai-stream.ts`

**Interfaces consumed:** `OpenStream` from `./types`. **Produced:** `openAssemblyaiStream: OpenStream`.

- [ ] **Step 1: Create `assemblyai-stream.ts`:**

```ts
import type { OpenStream } from "./types";

// Token is passed as a query param (RN WebSocket cannot set Authorization headers).
function wsUrl(token: string): string {
	return `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&encoding=pcm_s16le&format_turns=true&token=${encodeURIComponent(token)}`;
}

export const openAssemblyaiStream: OpenStream = ({ token, onEvent }) => {
	const ws = new WebSocket(wsUrl(token));
	ws.binaryType = "arraybuffer";

	ws.onmessage = (e) => {
		const msg = JSON.parse(e.data as string) as {
			type?: string;
			transcript?: string;
			end_of_turn?: boolean;
			turn_is_formatted?: boolean;
		};
		if (msg.type === "Begin") {
			onEvent({ type: "open" });
			return;
		}
		if (msg.type !== "Turn") return;
		const text = msg.transcript ?? "";
		// With format_turns=true: commit only the formatted end-of-turn; everything
		// else is a live partial (avoids double-committing the unformatted final).
		const isFinal = msg.end_of_turn === true && msg.turn_is_formatted === true;
		onEvent({ type: isFinal ? "final" : "partial", text });
	};
	ws.onerror = () => onEvent({ type: "error", message: "AssemblyAI connection error" });
	ws.onclose = () => onEvent({ type: "closed" });

	return {
		sendPcm: (data) => {
			if (ws.readyState === WebSocket.OPEN) ws.send(data);
		},
		close: () => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: "Terminate" }));
			}
			ws.close();
		},
	};
};
```

- [ ] **Step 2: Type-check** — `pnpm -F mobile exec tsc --noEmit` (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/streaming/assemblyai-stream.ts
git commit -m "feat(genesis-173): add AssemblyAI live streaming client"
```

---

## Task 6: Mobile "Live" mode (api helper + speech-lab UI)

**Files:**
- Modify: `apps/mobile/src/api/transcription.api.ts`
- Modify: `apps/mobile/src/app/(portal)/(tabs)/speech-lab.tsx`

**Interfaces consumed:** `getStreamToken` (api), `openDeepgramStream`, `openAssemblyaiStream`, `StreamingSession`, `StreamEvent`, `useAudioStream` (expo-audio), `StreamProvider` (`@repo/shared`).

- [ ] **Step 1: Add the api helper** — append to `transcription.api.ts`:

```ts
import type { StreamProvider } from "@repo/shared";

export function getStreamToken(provider: StreamProvider) {
	return client.transcription.streamToken({ provider });
}
```

- [ ] **Step 2: Add imports to `speech-lab.tsx`** — alongside the existing imports:

```ts
import { useAudioPlayer, useAudioStream } from "expo-audio";
import { getStreamToken } from "../../../api/transcription.api";
import { openAssemblyaiStream } from "../../../streaming/assemblyai-stream";
import { openDeepgramStream } from "../../../streaming/deepgram-stream";
import type { StreamingSession } from "../../../streaming/types";
```
(Merge `useAudioStream` into the existing `expo-audio` import line; it already imports `useAudioPlayer`.)

- [ ] **Step 3: Add Live-mode constants + state** — at module scope, near `PROVIDERS`:

```ts
const LIVE_PROVIDERS = [
	{ key: "deepgram" as const, label: "Deepgram Nova-3", open: openDeepgramStream },
	{ key: "assemblyai" as const, label: "AssemblyAI v3", open: openAssemblyaiStream },
];

// ~100 ms of int16 mono @16 kHz = 3200 bytes. AssemblyAI needs 50–1000 ms chunks.
const PCM_FLUSH_BYTES = 3200;

type LivePane = {
	status: "connecting" | "live" | "error" | "closed";
	committed: string;
	partial: string;
	firstLatencyMs?: number;
	error?: string;
};
```

Inside the component, add state + refs:

```ts
	const [liveActive, setLiveActive] = useState(false);
	const [livePanes, setLivePanes] = useState<Record<string, LivePane> | null>(null);
	const sessionsRef = useRef<StreamingSession[]>([]);
	const pcmChunksRef = useRef<Uint8Array[]>([]);
	const pcmBytesRef = useRef(0);
	const liveStartRef = useRef(0);

	const audioStream = useAudioStream({
		sampleRate: 16000,
		channels: 1,
		encoding: "int16",
		onBuffer: (buffer) => {
			pcmChunksRef.current.push(new Uint8Array(buffer.data));
			pcmBytesRef.current += buffer.data.byteLength;
			if (pcmBytesRef.current < PCM_FLUSH_BYTES) return;
			const merged = new Uint8Array(pcmBytesRef.current);
			let offset = 0;
			for (const chunk of pcmChunksRef.current) {
				merged.set(chunk, offset);
				offset += chunk.length;
			}
			pcmChunksRef.current = [];
			pcmBytesRef.current = 0;
			for (const session of sessionsRef.current) session.sendPcm(merged.buffer);
		},
	});
```

- [ ] **Step 4: Add start/stop handlers** — inside the component:

```ts
	function updatePane(key: string, patch: Partial<LivePane>) {
		setLivePanes((prev) => ({
			...prev,
			[key]: { ...(prev?.[key] ?? { status: "connecting", committed: "", partial: "" }), ...patch },
		}));
	}

	async function startLive() {
		setError(null);
		const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
		if (!perm.granted) {
			setError("Microphone permission not granted");
			return;
		}
		setLivePanes(
			Object.fromEntries(
				LIVE_PROVIDERS.map((p) => [p.key, { status: "connecting", committed: "", partial: "" }]),
			),
		);
		setLiveActive(true);
		liveStartRef.current = Date.now();
		const sessions: StreamingSession[] = [];
		for (const provider of LIVE_PROVIDERS) {
			try {
				const { token } = await getStreamToken(provider.key);
				const session = provider.open({
					token,
					onEvent: (event) => {
						if (event.type === "open") updatePane(provider.key, { status: "live" });
						else if (event.type === "partial")
							updatePane(provider.key, {
								partial: event.text,
								firstLatencyMs:
									livePanes?.[provider.key]?.firstLatencyMs ??
									Date.now() - liveStartRef.current,
							});
						else if (event.type === "final")
							setLivePanes((prev) => {
								const pane = prev?.[provider.key];
								const committed = `${pane?.committed ?? ""} ${event.text}`.trim();
								return { ...prev, [provider.key]: { ...pane!, committed, partial: "" } };
							});
						else if (event.type === "error")
							updatePane(provider.key, { status: "error", error: event.message });
						else if (event.type === "closed")
							updatePane(provider.key, { status: "closed" });
					},
				});
				sessions.push(session);
			} catch (e) {
				updatePane(provider.key, {
					status: "error",
					error: e instanceof Error ? e.message : "Could not start",
				});
			}
		}
		sessionsRef.current = sessions;
		if (sessions.length > 0) audioStream.start();
	}

	function stopLive() {
		audioStream.stop();
		for (const session of sessionsRef.current) session.close();
		sessionsRef.current = [];
		pcmChunksRef.current = [];
		pcmBytesRef.current = 0;
		setLiveActive(false);
	}
```

- [ ] **Step 5: Add the Live UI** — render near the top of the Speech tab's scroll content (above the existing record/cloud sections), inside the existing layout container:

```tsx
				<Button
					tone={liveActive ? "destructive" : "primary"}
					onPress={liveActive ? stopLive : startLive}
				>
					{liveActive ? "Stop live" : "Live transcribe (Deepgram + AssemblyAI)"}
				</Button>

				{livePanes ? (
					<View className="gap-2">
						{LIVE_PROVIDERS.map(({ key, label }) => {
							const pane = livePanes[key];
							return (
								<View key={key} className="gap-1 rounded-md border border-border p-3">
									<View className="flex-row items-center justify-between">
										<Text className="font-medium text-foreground text-sm">{label}</Text>
										<Text className="text-muted-foreground text-xs">
											{pane?.status}
											{pane?.firstLatencyMs != null
												? ` · first word ${(pane.firstLatencyMs / 1000).toFixed(1)}s`
												: ""}
										</Text>
									</View>
									{pane?.status === "error" ? (
										<Text className="text-destructive text-xs" selectable>
											{pane.error}
										</Text>
									) : (
										<Text className="text-foreground text-sm" selectable>
											{pane?.committed}
											{pane?.partial ? (
												<Text className="text-muted-foreground"> {pane.partial}</Text>
											) : null}
											{!pane?.committed && !pane?.partial ? "…" : ""}
										</Text>
									)}
								</View>
							);
						})}
					</View>
				) : null}
```

- [ ] **Step 6: Lint + type-check** — `pnpm biome check --write "apps/mobile/src/app/(portal)/(tabs)/speech-lab.tsx" apps/mobile/src/api/transcription.api.ts` then `pnpm -F mobile exec tsc --noEmit`. Both clean. (If `useAudioStream`'s returned object doesn't have `.start()`/`.stop()` under these exact names, check the installed `expo-audio` types in `node_modules/expo-audio/build/AudioStream.d.ts` and adjust — report as DONE_WITH_CONCERNS if the API differs from `{ start(); stop() }`.)

- [ ] **Step 7: Commit**

```bash
git add "apps/mobile/src/app/(portal)/(tabs)/speech-lab.tsx" apps/mobile/src/api/transcription.api.ts
git commit -m "feat(genesis-173): add live dual-provider streaming mode to speech lab"
```

---

## Task 7: Verification + live device test + journal

- [ ] **Step 1: Monorepo checks** — from the worktree: `pnpm check-types` (pass), `pnpm -F server exec vitest run src/controllers/transcription/` (pass), `pnpm build` (server + web pass). (Skip `pnpm check` if a prior `expo run:android` generated `apps/mobile/android` — known Biome-noise gotcha; the changed files were already Biome-formatted at commit.)

- [ ] **Step 2: Server up with keys** — ensure `DEEPGRAM_API_KEY` + `ASSEMBLYAI_API_KEY` are in `apps/server/.env`, start `pnpm dev:server`, confirm clean boot.

- [ ] **Step 3: Run the app** — `cd apps/mobile && npx expo start --dev-client -c` (set `EXPO_PUBLIC_SERVER_URL` to the machine's current LAN IP first). If the dev client errors that the `AudioStream` native module is missing, do a one-time `npx expo run:android`.

- [ ] **Step 4: Live test** — Speech tab → "Live transcribe" → speak. Confirm: both panes go `live`, interim text appears within ~1s (latency shown), text finalizes, "Stop live" closes cleanly, and one provider's token failure leaves the other working.

- [ ] **Step 5: Journal** — append a "Streaming (live) results" section to `docs/engineering/experiments/audio-transcription-on-device.md`: per-provider first-word latency, live-text quality/stability, and whether streaming changes the batch recommendation. Commit.

---

## Self-Review

- **Spec coverage:** temp-token direct architecture (Task 2 server mint + Tasks 4/5 client connect ✓); both providers simultaneous off one mic (Task 6 fan-out ✓); expo-audio `useAudioStream` int16/16k/mono (Task 6 ✓); single parameterized `streamToken` endpoint (Tasks 1–2 ✓); two live panes + latency (Task 6 ✓); error isolation per pane (Task 6 onEvent/error ✓); reuse existing env keys, no new vars (Global Constraints ✓); chunk batching to ~100 ms for AssemblyAI (Task 6 `PCM_FLUSH_BYTES` ✓); server dispatch test (Task 2 ✓); device test + journal (Task 7 ✓); out-of-scope items (iOS, reconnect, token refresh) not built ✓.
- **Placeholders:** none — every step has concrete code/commands. The two genuine unknowns are explicit verification steps with fallbacks (useAudioStream native presence → Task 7 rebuild; `useAudioStream` return-shape → Task 6 Step 6 check).
- **Type consistency:** `StreamProvider` = `"deepgram"|"assemblyai"` throughout; `StreamTokenResult { provider, token, expiresInSec }` matches server return and schema; `StreamingSession { sendPcm(ArrayBuffer), close() }` matches both client modules and the Task 6 `sessionsRef` usage; `OpenStream` signature matches `openDeepgramStream`/`openAssemblyaiStream`; `StreamEvent` union handled exhaustively in Task 6 `onEvent`.
