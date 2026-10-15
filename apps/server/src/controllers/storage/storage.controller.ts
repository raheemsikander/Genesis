import { protectedProcedure } from "../../orpc/procedures";
import {
	getFileUrl,
	handleFileUpload,
	listUserFiles,
	softDeleteFile,
} from "./storage.service";

export const storageController = {
	uploadFile: protectedProcedure.storage.uploadFile.handler(
		async ({ context, input }) => {
			return handleFileUpload(context.userId, input.file);
		},
	),

	getFileUrl: protectedProcedure.storage.getFileUrl.handler(
		async ({ context, input }) => {
			return getFileUrl(context.userId, input);
		},
	),

	listFiles: protectedProcedure.storage.listFiles.handler(
		async ({ context }) => {
			return listUserFiles(context.userId);
		},
	),

	deleteFile: protectedProcedure.storage.deleteFile.handler(
		async ({ context, input }) => {
			return softDeleteFile(context.userId, input);
		},
	),
};
