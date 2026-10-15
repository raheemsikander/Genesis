import type { StreamProvider, TranscriptionProvider } from "@repo/shared";
import { client } from "../utils/orpc";

/**
 * Call the transcription endpoint for a single provider. The Speech screen fires one
 * of these per provider in parallel, so we use the raw client (not a TanStack mutation
 * with shared state) to keep each result independent.
 */
export function transcribeAudioWith(
	file: File,
	provider: TranscriptionProvider,
) {
	return client.transcription.transcribeAudio({ file, provider });
}

export function getStreamToken(provider: StreamProvider) {
	return client.transcription.streamToken({ provider });
}
