import { eq } from "drizzle-orm";
import { db, users } from "../../db/index";
import { logger } from "../../utils/logger";
import {
	QUEUES,
	registerJob,
	type SampleBackgroundPayload,
} from "../job-registry";

registerJob<SampleBackgroundPayload>({
	queue: QUEUES.SAMPLE_BACKGROUND,
	handler: async (job) => {
		const user = await db.query.users.findFirst({
			where: eq(users.clerkId, job.data.userId),
			columns: { clerkId: true, name: true },
		});

		const name = user?.name ?? "Unknown";
		logger.info(
			{ userId: job.data.userId, email: job.data.email },
			`Processing sample background job for ${name}`,
		);

		// TODO: Replace with actual business logic
	},
});
