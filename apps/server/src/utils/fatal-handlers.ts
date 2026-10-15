import { flushAlerts } from "./alerting";
import { logger } from "./logger";

/**
 * Rollbar's `unhandledRejection` listener reports and returns, and merely having
 * a listener suppresses Node's default crash. Without this the process pages
 * `critical` and then keeps serving on state nobody can reason about, which is
 * the half-response the alerting strategy exists to avoid. Rollbar has already
 * queued the report by the time this runs, so this only drains and exits.
 * `exitOnUncaughtException` in `rollbar.ts` covers the synchronous twin.
 */
export function installFatalHandlers(): void {
	process.on("unhandledRejection", (reason) => {
		logger.fatal({ err: reason }, "unhandled rejection, exiting");
		// A tracker that cannot be drained must not be the reason a process in
		// undefined state stays up, nor become a second unhandled rejection.
		void flushAlerts()
			.catch(() => {})
			.then(() => process.exit(1));
	});
}
