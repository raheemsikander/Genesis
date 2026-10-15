import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "./contracts";

export {
	isRetryableError,
	queryRetryOptions,
	RETRYABLE_CODES,
} from "./query-retry";
export { appContract };

export type AppRouterClient = ContractRouterClient<typeof appContract>;
