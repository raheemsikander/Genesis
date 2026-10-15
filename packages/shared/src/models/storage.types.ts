import { z } from "zod";

// ----- Constants -----

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ----- Inputs -----

// React Native has no `File`; mobile uploads are a `Blob` with a `name` own
// property (see apps/mobile/src/utils/to-upload-file.ts). Type the input as the
// honest union so native callers don't have to cast through `File`.
export const UploadFileInputSchema = z.object({
	file: z.custom<File | (Blob & { name: string })>(
		(val) =>
			val instanceof File ||
			(typeof val === "object" &&
				val !== null &&
				"name" in val &&
				"size" in val),
	),
});

export type UploadFileInput = z.infer<typeof UploadFileInputSchema>;

export const GetFileUrlInputSchema = z.object({
	uuid: z.string().uuid(),
	mode: z.enum(["view", "download"]),
});

export type GetFileUrlInput = z.infer<typeof GetFileUrlInputSchema>;

export const DeleteFileInputSchema = z.object({
	uuid: z.string().uuid(),
});

export type DeleteFileInput = z.infer<typeof DeleteFileInputSchema>;

// ----- Outputs -----

export const FileUrlSchema = z.object({
	url: z.string(),
});

export type FileUrl = z.infer<typeof FileUrlSchema>;

export const FileRecordSchema = z.object({
	uuid: z.string().uuid(),
	fileName: z.string(),
	contentType: z.string(),
	sizeBytes: z.number(),
	createdBy: z.string().uuid(),
	createdAt: z.date(),
	updatedBy: z.string().uuid(),
	updatedAt: z.date(),
	deletedAt: z.date().nullable(),
});

export type FileRecord = z.infer<typeof FileRecordSchema>;

export const FileListSchema = z.object({
	files: z.array(FileRecordSchema),
});

export type FileList = z.infer<typeof FileListSchema>;

export const DeleteFileResultSchema = z.object({
	deleted: z.boolean(),
});

export type DeleteFileResult = z.infer<typeof DeleteFileResultSchema>;
