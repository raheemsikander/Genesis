// Import all job files — each calls registerJob() as a side effect.
// When adding a new job, add its import here (or use the add-background-or-scheduled-task skill).
import "./dead-letter.job";
import "./sample-background.job";
import "./sample-scheduled.job";

export {
	closeAllQueues,
	DEFAULT_JOB_OPTIONS,
	DEFAULT_WORKER_OPTIONS,
	getQueue,
	getRegisteredJobs,
	QUEUES,
} from "../job-registry";
