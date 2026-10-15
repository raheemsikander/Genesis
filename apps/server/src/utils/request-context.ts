import { AsyncLocalStorage } from "node:async_hooks";

// Context stored during HTTP requests — just the requestId
export interface RequestContext {
	requestId: string;
}

// Context stored during BullMQ jobs — includes job-specific fields
export interface JobContext extends RequestContext {
	jobId: string;
	queue: string;
}

export type AppContext = RequestContext | JobContext;

// Type guard: narrows AppContext to JobContext when jobId is present
export function isJobContext(ctx: AppContext): ctx is JobContext {
	return "jobId" in ctx;
}

const requestContext = new AsyncLocalStorage<AppContext>();

// Read the current request/job context. Returns undefined outside a request or job.
export function getRequestContext(): AppContext | undefined {
	return requestContext.getStore();
}

// Only middleware and the worker should open new contexts.
export function runWithRequestContext<T>(ctx: AppContext, fn: () => T): T {
	return requestContext.run(ctx, fn);
}
