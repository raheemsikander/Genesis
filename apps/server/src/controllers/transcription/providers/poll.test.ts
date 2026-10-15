import { describe, expect, it } from "vitest";
import { pollUntil } from "./poll";

describe("pollUntil", () => {
	it("resolves with the value once poll reports done", async () => {
		let calls = 0;
		const value = await pollUntil<string>({
			intervalMs: 1,
			timeoutMs: 1000,
			poll: async () => {
				calls += 1;
				return calls < 3
					? { status: "pending" }
					: { status: "done", value: "hello" };
			},
		});
		expect(value).toBe("hello");
		expect(calls).toBe(3);
	});

	it("throws when poll reports an error", async () => {
		await expect(
			pollUntil({
				intervalMs: 1,
				timeoutMs: 1000,
				poll: async () => ({ status: "error", error: "rejected" }),
			}),
		).rejects.toThrow("rejected");
	});

	it("throws on timeout when never done", async () => {
		await expect(
			pollUntil({
				intervalMs: 1,
				timeoutMs: 0,
				poll: async () => ({ status: "pending" }),
			}),
		).rejects.toThrow("timed out");
	});
});
