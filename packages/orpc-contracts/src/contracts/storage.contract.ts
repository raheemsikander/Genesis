import { oc } from "@orpc/contract";
import {
	DeleteFileInputSchema,
	DeleteFileResultSchema,
	FileListSchema,
	FileRecordSchema,
	FileUrlSchema,
	GetFileUrlInputSchema,
	UploadFileInputSchema,
} from "@repo/shared";

export const storageContract = {
	uploadFile: oc.input(UploadFileInputSchema).output(FileRecordSchema),
	getFileUrl: oc.input(GetFileUrlInputSchema).output(FileUrlSchema),
	listFiles: oc.output(FileListSchema),
	deleteFile: oc.input(DeleteFileInputSchema).output(DeleteFileResultSchema),
};
