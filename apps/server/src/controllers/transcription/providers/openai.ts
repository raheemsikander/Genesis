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
