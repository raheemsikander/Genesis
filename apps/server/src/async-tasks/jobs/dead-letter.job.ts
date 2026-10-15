import { logger } from "../../utils/logger";
import { type DeadLetterPayload, QUEUES, registerJob } from "../job-registry";

registerJob<DeadLetterPayload>({
	queue: QUEUES.SYSTEM_DEAD_LETTER,
	handler: async (job) => {
		logger.error(
			{
				originalQueue: job.data.originalQueue,
				originalJobId: job.data.jobId,
				payload: job.data.payload,
				error: job.data.error,
				failedAt: job.data.failedAt,
				originalRequestId: job.data.requestId,
			},
			"Dead letter: job permanently failed",
		);
	},
	workerOptions: {
		concurrency: 1, // process DLQ jobs sequentially
	},
});
