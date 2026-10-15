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
export async function transcribeAssemblyai(
	file: File,
): Promise<ProviderResult> {
	const key = env.ASSEMBLYAI_API_KEY;
	if (!key)
		throw new Error("AssemblyAI not configured. Set ASSEMBLYAI_API_KEY.");

	try {
		const bytes = Buffer.from(await file.arrayBuffer());

		const uploadRes = await fetch(`${BASE}/upload`, {
			method: "POST",
			headers: {
				authorization: key,
				"content-type": "application/octet-stream",
			},
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
