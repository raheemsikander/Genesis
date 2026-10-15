import { ORPCError } from "@orpc/server";
import { MAX_FILE_SIZE_BYTES, type StreamProvider, type TranscriptionProvider } from "@repo/shared";
import { transcribeAssemblyai } from "./providers/assemblyai";
import { transcribeDeepgram } from "./providers/deepgram";
import { transcribeOpenai } from "./providers/openai";
import { transcribeSpeechmatics } from "./providers/speechmatics";
import { mintAssemblyaiToken, mintDeepgramToken } from "./providers/stream-tokens";
import type { ProviderResult } from "./providers/types";

const DISPATCH: Record<
	TranscriptionProvider,
	(file: File) => Promise<ProviderResult>
> = {
	deepgram: transcribeDeepgram,
	assemblyai: transcribeAssemblyai,
	"openai-gpt4o": (file) => transcribeOpenai(file, "gpt-4o-transcribe"),
	"openai-gpt4o-mini": (file) =>
		transcribeOpenai(file, "gpt-4o-mini-transcribe"),
	speechmatics: transcribeSpeechmatics,
};

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
