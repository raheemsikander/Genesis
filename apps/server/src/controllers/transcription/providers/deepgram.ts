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
