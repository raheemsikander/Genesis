import { ORPCError } from "@orpc/server";
import type Rollbar from "rollbar";
import { logger } from "./logger";
import { getRequestContext, isJobContext } from "./request-context";
import { rollbar } from "./rollbar";

export const AlertSeverity = {
	WARNING: "warning",
	ERROR: "error",
	CRITICAL: "critical",
} as const;

export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export interface ReportAlertOptions {
	severity?: AlertSeverity;
	context?: Record<string, unknown>;
	/**
	 * The Express request, when there is one. The tracker parses headers, query
	 * and client IP off it, and its express middleware does not pick the request
	 * up on its own, so an omitted request means an item with no request panel.
	 */
	request?: object;
}

const DEFAULT_FLUSH_TIMEOUT_MS = 2_000;

/**
 * A 4xx is the API telling a caller it asked for the wrong thing. That is the
 * contract working, not an incident, so it never reaches the tracker.
 */
export function isAlertable(error: unknown): boolean {
	return !(error instanceof ORPCError && error.status < 500);
}

export function reportAlert(
	error: unknown,
	options?: ReportAlertOptions,
): void {
	try {
		const report = trackerFor(options?.severity ?? AlertSeverity.ERROR);
		const payload = {
			custom: { ...options?.context, ...correlationFields() },
		};

		if (options?.request === undefined) {
			report(toReportable(error), payload);
			return;
		}
		report(toReportable(error), options.request, payload);
	} catch (reportingError) {
		logger.error({ err: reportingError }, "failed to report alert");
	}
}

/** Drain buffered reports before an intentional exit, without letting a hung tracker block it. */
export function flushAlerts(
	timeoutMs = DEFAULT_FLUSH_TIMEOUT_MS,
): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, timeoutMs);
		timer.unref?.();

		try {
			rollbar.wait(() => {
				clearTimeout(timer);
				resolve();
			});
		} catch (reportingError) {
			clearTimeout(timer);
			logger.error({ err: reportingError }, "failed to flush alerts");
			resolve();
		}
	});
}

type TrackerReport = (error: Error, ...rest: Rollbar.LogArgument[]) => void;

function trackerFor(severity: AlertSeverity): TrackerReport {
	switch (severity) {
		case AlertSeverity.WARNING:
			return (error, ...rest) => rollbar.warning(error, ...rest);
		case AlertSeverity.CRITICAL:
			return (error, ...rest) => rollbar.critical(error, ...rest);
		default:
			return (error, ...rest) => rollbar.error(error, ...rest);
	}
}

function toReportable(error: unknown): Error {
	if (error instanceof Error) return error;
	return new Error(`Non-error value thrown: ${stringify(error)}`);
}

function stringify(value: unknown): string {
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}

/**
 * Spread last by callers so correlation stays authoritative: an alert whose
 * requestId can be shadowed by a caller is an alert you cannot trace back.
 */
function correlationFields(): Record<string, unknown> {
	const ctx = getRequestContext();
	if (!ctx) return {};

	if (isJobContext(ctx)) {
		return { requestId: ctx.requestId, jobId: ctx.jobId, queue: ctx.queue };
	}
	return { requestId: ctx.requestId };
}
