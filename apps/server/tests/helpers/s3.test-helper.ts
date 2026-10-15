import {
	CreateBucketCommand,
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getS3Client } from "../../src/storage";
import { env } from "../../src/utils/env";

/**
 * Only the already-ours case is benign. BucketAlreadyExists means the name
 * belongs to someone else, and swallowing it would leave the suite writing
 * into a bucket it has no access to, surfacing later as an opaque AccessDenied.
 */
const BUCKET_ALREADY_OURS = "BucketAlreadyOwnedByYou";

/** S3 rejects a DeleteObjects request carrying more than this many keys. */
const DELETE_BATCH_LIMIT = 1000;

function errorName(error: unknown): string {
	return (error as { name?: string })?.name ?? "";
}

export async function ensureTestBucket(): Promise<void> {
	try {
		await getS3Client().send(
			new CreateBucketCommand({ Bucket: env.S3_BUCKET }),
		);
	} catch (error) {
		if (errorName(error) !== BUCKET_ALREADY_OURS) {
			throw error;
		}
	}
}

export async function getObjectBytes(key: string): Promise<Buffer> {
	const result = await getS3Client().send(
		new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
	);

	if (!result.Body) throw new Error(`Object ${key} has no body`);

	return Buffer.from(await result.Body.transformToByteArray());
}

export async function objectExists(key: string): Promise<boolean> {
	try {
		await getS3Client().send(
			new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
		);
		return true;
	} catch (error) {
		const name = errorName(error);
		const status = (error as { $metadata?: { httpStatusCode?: number } })
			?.$metadata?.httpStatusCode;

		if (name === "NotFound" || name === "NoSuchKey" || status === 404) {
			return false;
		}
		throw error;
	}
}

export async function listObjectKeys(prefix?: string): Promise<string[]> {
	const keys: string[] = [];
	let continuationToken: string | undefined;

	do {
		const page = await getS3Client().send(
			new ListObjectsV2Command({
				Bucket: env.S3_BUCKET,
				Prefix: prefix,
				ContinuationToken: continuationToken,
			}),
		);

		for (const object of page.Contents ?? []) {
			if (object.Key) keys.push(object.Key);
		}
		continuationToken = page.NextContinuationToken;
	} while (continuationToken);

	return keys;
}

export async function deleteAllObjects(prefix: string): Promise<void> {
	const keys = await listObjectKeys(prefix);

	for (let i = 0; i < keys.length; i += DELETE_BATCH_LIMIT) {
		const batch = keys.slice(i, i + DELETE_BATCH_LIMIT);

		const result = await getS3Client().send(
			new DeleteObjectsCommand({
				Bucket: env.S3_BUCKET,
				Delete: { Objects: batch.map((Key) => ({ Key })) },
			}),
		);

		/**
		 * DeleteObjects reports per-key failures in the response rather than
		 * rejecting. Swallowing them would leak objects into the next test and
		 * turn a "the bucket is empty" assertion into a false pass.
		 */
		if (result.Errors?.length) {
			throw new Error(
				`Failed to delete ${result.Errors.length} object(s): ${result.Errors.map(
					(error) => `${error.Key}: ${error.Message}`,
				).join(", ")}`,
			);
		}
	}
}
