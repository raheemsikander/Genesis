const TRANSIENT_NETWORK_CODES = new Set([
	"ECONNRESET",
	"ETIMEDOUT",
	"ECONNREFUSED",
	"EAI_AGAIN",
	"ENOTFOUND",
	"EPIPE",
	"EHOSTUNREACH",
	"ENETUNREACH",
]);

function extractStatus(err: unknown): number | undefined {
	if (!err || typeof err !== "object") return undefined;
	const e = err as Record<string, unknown>;
	if (typeof e.status === "number") return e.status;
	if (typeof e.statusCode === "number") return e.statusCode;
	const response = e.response as Record<string, unknown> | undefined;
	if (response && typeof response.status === "number") return response.status;
	if (response && typeof response.statusCode === "number")
		return response.statusCode;
	return undefined;
}

export function isTransient(err: unknown): boolean {
	if (err && typeof err === "object") {
		const code = (err as { code?: unknown }).code;
		if (typeof code === "string" && TRANSIENT_NETWORK_CODES.has(code)) {
			return true;
		}
	}

	const status = extractStatus(err);
	if (status === 408 || status === 429) return true;
	if (status !== undefined && status >= 500 && status < 600) return true;

	return false;
}

export type RetryOptions = {
	attempts?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
	jitter?: boolean;
	isRetryable?: (err: unknown) => boolean;
	signal?: AbortSignal;
	onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) {
		return Promise.reject(signal.reason ?? new Error("Aborted"));
	}
	return new Promise((resolve, reject) => {
		let onAbort: (() => void) | undefined;
		const cleanup = () => {
			if (onAbort) signal?.removeEventListener("abort", onAbort);
		};
		const timer = setTimeout(() => {
			cleanup();
			resolve();
		}, ms);
		if (signal) {
			onAbort = () => {
				clearTimeout(timer);
				cleanup();
				reject(signal.reason ?? new Error("Aborted"));
			};
			signal.addEventListener("abort", onAbort, { once: true });
		}
	});
}

// Caller must ensure fn is idempotent — retries replay the operation.
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const {
		attempts = 3,
		baseDelayMs = 200,
		maxDelayMs = 2000,
		jitter = true,
		isRetryable = isTransient,
		signal,
		onRetry,
	} = options;

	if (attempts < 1) {
		throw new Error("withRetry: attempts must be >= 1");
	}

	if (signal?.aborted) {
		throw signal.reason ?? new Error("Aborted");
	}

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fn();
		} catch (err) {
			if (attempt === attempts || !isRetryable(err)) {
				throw err;
			}
			const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
			// AWS "full jitter": delay is uniform in [0, exp); can be ~0ms.
			const delay = jitter ? Math.floor(Math.random() * exp) : exp;
			try {
				onRetry?.(err, attempt, delay);
			} catch {
				// Swallow callback errors so they don't break the retry contract.
			}
			await sleep(delay, signal);
		}
	}
	// The loop above always returns or throws; this satisfies TS's return-path analysis.
	throw new Error("withRetry: unreachable");
}
