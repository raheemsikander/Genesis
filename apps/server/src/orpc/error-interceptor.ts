import { type Context, ORPCError, onError } from "@orpc/server";
import type { StandardHandlerOptions } from "@orpc/server/standard";
import { isAlertable, reportAlert } from "../utils/alerting";
import { logger } from "../utils/logger";

export function handleRpcError(error: unknown): void {
	if (error instanceof ORPCError && error.status < 500) {
		logger.warn({ err: error }, "rpc client error");
		return;
	}

	logger.error({ err: error }, "rpc error");

	if (isAlertable(error)) {
		reportAlert(error);
	}
}

export const errorInterceptors: StandardHandlerOptions<Context>["interceptors"] =
	[onError(handleRpcError)];
