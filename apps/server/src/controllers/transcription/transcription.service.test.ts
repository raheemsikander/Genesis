import { MAX_FILE_SIZE_BYTES } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./providers/deepgram", () => ({ transcribeDeepgram: vi.fn() }));
vi.mock("./providers/openai", () => ({ transcribeOpenai: vi.fn() }));
vi.mock("./providers/assemblyai", () => ({ transcribeAssemblyai: vi.fn() }));
vi.mock("./providers/speechmatics", () => ({
	transcribeSpeechmatics: vi.fn(),
}));
vi.mock("./providers/stream-tokens", () => ({
	mintDeepgramToken: vi.fn(),
	mintAssemblyaiToken: vi.fn(),
}));

import { transcribeAssemblyai } from "./providers/assemblyai";
import { transcribeDeepgram } from "./providers/deepgram";
import { transcribeOpenai } from "./providers/openai";
import { transcribeAudio } from "./transcription.service";

const smallFile = { size: 1000, type: "audio/wav" } as File;
const result = {
	transcript: "hi",
	confidence: 0.9,
	durationSec: 1,
	model: "nova-3",
};

describe("transcribeAudio dispatch", () => {
	beforeEach(() => vi.clearAllMocks());

	it("routes deepgram and attaches the provider", async () => {
		vi.mocked(transcribeDeepgram).mockResolvedValue(result);
		const out = await transcribeAudio(smallFile, "deepgram");
		expect(transcribeDeepgram).toHaveBeenCalledWith(smallFile);
		expect(out).toEqual({ ...result, provider: "deepgram" });
	});

	it("routes assemblyai", async () => {
		vi.mocked(transcribeAssemblyai).mockResolvedValue({
			...result,
			model: "universal-3-pro",
		});
		const out = await transcribeAudio(smallFile, "assemblyai");
		expect(out.provider).toBe("assemblyai");
		expect(out.model).toBe("universal-3-pro");
	});

	it("maps the two openai keys to the right model arg", async () => {
		vi.mocked(transcribeOpenai).mockResolvedValue({
			...result,
			model: "gpt-4o-mini-transcribe",
		});
		await transcribeAudio(smallFile, "openai-gpt4o-mini");
		expect(transcribeOpenai).toHaveBeenCalledWith(
			smallFile,
			"gpt-4o-mini-transcribe",
		);
	});

	it("rejects oversize files before dispatching", async () => {
		const big = { size: MAX_FILE_SIZE_BYTES + 1, type: "audio/wav" } as File;
		await expect(transcribeAudio(big, "deepgram")).rejects.toMatchObject({
			code: "PAYLOAD_TOO_LARGE",
		});
		expect(transcribeDeepgram).not.toHaveBeenCalled();
	});
});
