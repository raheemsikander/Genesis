import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../utils/env";

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
	if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
		throw new Error(
			"Storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY to enable.",
		);
	}
	if (!_client) {
		_client = new S3Client({
			region: env.S3_REGION,
			endpoint: env.S3_ENDPOINT,
			credentials: {
				accessKeyId: env.S3_ACCESS_KEY_ID,
				secretAccessKey: env.S3_SECRET_ACCESS_KEY,
			},
			forcePathStyle: true,
		});
	}
	return _client;
}
