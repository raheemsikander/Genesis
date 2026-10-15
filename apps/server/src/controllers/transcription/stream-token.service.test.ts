import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all providers so env is never loaded during module initialisation.
vi.mock("./providers/stream-tokens", () => ({
	mintDeepgramToken: vi.fn(),
	mintAssemblyaiToken: vi.fn(),
}));
vi.mock("./providers/deepgram", () => ({ transcribeDeepgram: vi.fn() }));
vi.mock("./providers/openai", () => ({ transcribeOpenai: vi.fn() }));
vi.mock("./providers/assemblyai", () => ({ transcribeAssemblyai: vi.fn() }));
vi.mock("./providers/speechmatics", () => ({ transcribeSpeechmatics: vi.fn() }));

import { mintAssemblyaiToken, mintDeepgramToken } from "./providers/stream-tokens";
import { getStreamToken } from "./transcription.service";

describe("getStreamToken dispatch", () => {
	beforeEach(() => vi.clearAllMocks());

	it("routes deepgram and attaches the provider", async () => {
		vi.mocked(mintDeepgramToken).mockResolvedValue({
			token: "dg-token",
			expiresInSec: 60,
		});
		const out = await getStreamToken("deepgram");
		expect(mintDeepgramToken).toHaveBeenCalledOnce();
		expect(out).toEqual({ provider: "deepgram", token: "dg-token", expiresInSec: 60 });
	});

	it("routes assemblyai", async () => {
		vi.mocked(mintAssemblyaiToken).mockResolvedValue({
			token: "aai-token",
			expiresInSec: 60,
		});
		const out = await getStreamToken("assemblyai");
		expect(mintAssemblyaiToken).toHaveBeenCalledOnce();
		expect(out.provider).toBe("assemblyai");
		expect(out.token).toBe("aai-token");
	});
});
