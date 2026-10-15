import { ORPCError } from "@orpc/server";
import { env } from "../../../utils/env";
import { logger } from "../../../utils/logger";
import { pollUntil } from "./poll";
import type { ProviderResult } from "./types";

const BASE = "https://asr.api.speechmatics.com/v2";
const MODEL = "enhanced";

type ResultItem = {
	type?: string;
	alternatives?: Array<{ content?: string; confidence?: number }>;
};

/** Reassemble json-v2 results: words are space-separated, punctuation attaches with no leading space. */
function assembleTranscript(results: ResultItem[]): string {
	let out = "";
	for (const item of results) {
		const content = item.alternatives?.[0]?.content ?? "";
		if (!content) continue;
		out += item.type === "punctuation" ? content : (out ? " " : "") + content;
	}
	return out;
}

function averageConfidence(results: ResultItem[]): number | null {
	const confidences = results
		// Exclude punctuation (reported at ~1.0) so the mean reflects word-level confidence.
		.filter((r) => r.type !== "punctuation")
		.map((r) => r.alternatives?.[0]?.confidence)
		.filter((c): c is number => typeof c === "number");
	if (confidences.length === 0) return null;
	return confidences.reduce((a, b) => a + b, 0) / confidences.length;
}

/**
 * Speechmatics is async: create a batch job (multipart audio + config), poll the
 * job until done, then fetch the json-v2 transcript. Confidence is per-item, so we
 * report the mean.
 */
export async function transcribeSpeechmatics(
	file: File,
): Promise<ProviderResult> {
	const key = env.SPEECHMATICS_API_KEY;
	if (!key)
		throw new Error("Speechmatics not configured. Set SPEECHMATICS_API_KEY.");

	try {
		const form = new FormData();
		form.append("data_file", file, file.name || "audio.wav");
		form.append(
			"config",
			JSON.stringify({
				type: "transcription",
				transcription_config: { language: "en", operating_point: "enhanced" },
			}),
		);

		const createRes = await fetch(`${BASE}/jobs`, {
			method: "POST",
			headers: { Authorization: `Bearer ${key}` },
			body: form,
		});
		if (!createRes.ok) throw new Error(`create ${createRes.status}`);
		const created = (await createRes.json()) as {
			id?: string;
			job?: { id?: string };
		};
		const jobId = created.id ?? created.job?.id;
		if (!jobId) throw new Error("speechmatics: no job id in create response");

		await pollUntil<true>({
			intervalMs: 3000,
			timeoutMs: 5 * 60 * 1000,
			poll: async () => {
				const res = await fetch(`${BASE}/jobs/${jobId}`, {
					headers: { Authorization: `Bearer ${key}` },
				});
				if (!res.ok) throw new Error(`poll ${res.status}`);
				const { job } = (await res.json()) as { job: { status: string } };
				if (job.status === "done") return { status: "done", value: true };
				if (job.status === "rejected")
					return { status: "error", error: "job rejected" };
				return { status: "pending" };
			},
		});

		const transcriptRes = await fetch(
			`${BASE}/jobs/${jobId}/transcript?format=json-v2`,
			{ headers: { Authorization: `Bearer ${key}` } },
		);
		if (!transcriptRes.ok)
			throw new Error(`transcript ${transcriptRes.status}`);
		const data = (await transcriptRes.json()) as {
			results?: ResultItem[];
			job?: { duration?: number };
		};
		const results = data.results ?? [];

		return {
			transcript: assembleTranscript(results),
			confidence: averageConfidence(results),
			durationSec: data.job?.duration ?? null,
			model: MODEL,
		};
	} catch (err) {
		logger.error({ err }, "Speechmatics transcription failed");
		throw new ORPCError("BAD_GATEWAY", { message: "Transcription failed" });
	}
}
