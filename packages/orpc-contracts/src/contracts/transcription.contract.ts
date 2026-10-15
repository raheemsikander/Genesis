import { oc } from "@orpc/contract";
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
