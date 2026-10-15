type PollState<T> =
	| { status: "pending" }
	| { status: "done"; value: T }
	| { status: "error"; error?: string };

/**
 * Poll an async job until it reports done, errors, or the timeout elapses.
 * `poll` is called immediately, then every `intervalMs` until the deadline.
 */
export async function pollUntil<T>(opts: {
	poll: () => Promise<PollState<T>>;
	intervalMs: number;
	timeoutMs: number;
}): Promise<T> {
	const deadline = Date.now() + opts.timeoutMs;
	while (true) {
		const state = await opts.poll();
		if (state.status === "done") return state.value;
		if (state.status === "error")
			throw new Error(state.error ?? "transcription job failed");
		if (Date.now() >= deadline) throw new Error("transcription timed out");
		await new Promise((resolve) => setTimeout(resolve, opts.intervalMs));
	}
}
