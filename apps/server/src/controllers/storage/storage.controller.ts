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
			return handleFileUpload(context.dbUser, input.file);
		},
	),

	getFileUrl: protectedProcedure.storage.getFileUrl.handler(
		async ({ context, input }) => {
			return getFileUrl(context.dbUser, input);
		},
	),

	listFiles: protectedProcedure.storage.listFiles.handler(
		async ({ context }) => {
			return listUserFiles(context.dbUser);
		},
	),

	deleteFile: protectedProcedure.storage.deleteFile.handler(
		async ({ context, input }) => {
			return softDeleteFile(context.dbUser, input);
		},
	),
};
