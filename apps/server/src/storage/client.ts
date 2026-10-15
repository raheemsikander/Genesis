import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../utils/env";

let _client: S3Client | null = null;
let _presignClient: S3Client | null = null;

/**
 * Checksums only when an operation requires one. By default the SDK signs a
 * CRC32 of the empty body into every presigned PUT URL, and storage that
 * verifies it (Garage, SeaweedFS, AWS) then rejects the real upload.
 */
function createClient(
	endpoint: string,
	accessKeyId: string,
	secretAccessKey: string,
): S3Client {
	return new S3Client({
		region: env.S3_REGION,
		endpoint,
		credentials: { accessKeyId, secretAccessKey },
		forcePathStyle: true,
		requestChecksumCalculation: "WHEN_REQUIRED",
		responseChecksumValidation: "WHEN_REQUIRED",
	});
}

export function getS3Client(): S3Client {
	if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
		throw new Error(
			"Storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY to enable.",
		);
	}
	if (!_client) {
		_client = createClient(
			env.S3_ENDPOINT,
			env.S3_ACCESS_KEY_ID,
			env.S3_SECRET_ACCESS_KEY,
		);
	}
	return _client;
}

/**
 * Returns an S3Client whose endpoint is the public-facing URL clients will
 * use to reach storage. When S3_PUBLIC_ENDPOINT is set, a second client is
 * constructed against that endpoint so presigned URLs are signed with the
 * correct host. AWS SigV4 covers the host header, so you cannot swap the host
 * after signing. When S3_PUBLIC_ENDPOINT is unset, the internal client is
 * reused and behaviour is identical to before this change.
 *
 * Use this client ONLY for GET presigned URLs returned to end users.
 * Uploads, deletes, and all server-internal operations use getS3Client().
 */
export function getPresignClient(): S3Client {
	if (!env.S3_PUBLIC_ENDPOINT) {
		return getS3Client();
	}
	if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
		throw new Error(
			"Storage is not configured. Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY to enable.",
		);
	}
	if (!_presignClient) {
		_presignClient = createClient(
			env.S3_PUBLIC_ENDPOINT,
			env.S3_ACCESS_KEY_ID,
			env.S3_SECRET_ACCESS_KEY,
		);
	}
	return _presignClient;
}
