import pino from "pino";
import { env } from "./env";
import { getRequestContext, isJobContext } from "./request-context";

export const logger = pino({
	level: env.LOG_LEVEL ?? "info",
	/**
	 * pino-http logs req/res including headers; redact credentials so bearer
	 * tokens and session cookies never land in logs.
	 */
	redact: {
		paths: [
			"req.headers.authorization",
			"req.headers.cookie",
			'res.headers["set-cookie"]',
		],
		censor: "[redacted]",
	},
	// Called on every log line. Peeks into AsyncLocalStorage and merges
	// requestId (+ jobId/queue for workers) into the log output automatically.
	mixin() {
		const ctx = getRequestContext();
		if (!ctx) return {};
		if (isJobContext(ctx)) {
			return { requestId: ctx.requestId, jobId: ctx.jobId, queue: ctx.queue };
		}
		return { requestId: ctx.requestId };
	},
	transport:
		env.NODE_ENV !== "production"
			? {
					target: "pino-pretty",
					options: { colorize: true, ignore: "pid,hostname" },
				}
			: undefined,
});
