import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../utils/env";
import { getPresignClient, getS3Client } from "./client";

const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

export async function uploadBuffer(
	key: string,
	body: Buffer,
	contentType: string,
): Promise<void> {
	const command = new PutObjectCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
		Body: body,
		ContentType: contentType,
	});

	await getS3Client().send(command);
}

export async function createPresignedUrl(
	key: string,
	fileName: string,
	mode: "view" | "download",
): Promise<string> {
	const encoded = encodeURIComponent(fileName);
	const contentDisposition =
		mode === "view"
			? "inline"
			: `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`;

	const command = new GetObjectCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
		ResponseContentDisposition: contentDisposition,
	});

	return getSignedUrl(getPresignClient(), command, {
		expiresIn: PRESIGNED_URL_EXPIRY,
	});
}

export async function deleteObject(key: string): Promise<void> {
	const command = new DeleteObjectCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
	});

	await getS3Client().send(command);
}
