import { count } from "drizzle-orm";
import { db, users } from "../../db/index";
import { logger } from "../../utils/logger";
import { QUEUES, registerJob } from "../job-registry";

registerJob({
	queue: QUEUES.SAMPLE_SCHEDULED,
	handler: async () => {
		const [result] = await db.select({ count: count() }).from(users);
		logger.info(
			`Scheduled heartbeat: ${new Date().toISOString()} — ${result?.count ?? 0} user(s) in the database`,
		);
	},
	schedule: {
		schedulerId: "sample-scheduled-every-minute",
		pattern: "* * * * *", // every minute
	},
});
