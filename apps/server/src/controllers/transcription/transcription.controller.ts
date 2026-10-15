import { protectedProcedure } from "../../orpc/procedures";
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
