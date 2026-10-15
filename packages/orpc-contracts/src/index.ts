import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "./contracts";

export { appContract };

export type AppRouterClient = ContractRouterClient<typeof appContract>;
