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
