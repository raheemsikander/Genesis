import { ORPCError } from "@orpc/server";
import { env } from "../../../utils/env";
import { logger } from "../../../utils/logger";

type MintedToken = { token: string; expiresInSec: number };

/** Deepgram: short-lived JWT via POST /v1/auth/grant (key stays server-side). */
export async function mintDeepgramToken(): Promise<MintedToken> {
	if (!env.DEEPGRAM_API_KEY) {
		throw new Error("Deepgram not configured. Set DEEPGRAM_API_KEY.");
	}
	let response: Response;
	try {
		response = await fetch("https://api.deepgram.com/v1/auth/grant", {
			method: "POST",
			headers: {
				Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ ttl_seconds: 60 }),
		});
	} catch (err) {
		logger.error({ err }, "Deepgram token request failed to send");
		throw new ORPCError("BAD_GATEWAY", {
			message: "Streaming token service unreachable",
		});
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		logger.error({ status: response.status, detail }, "Deepgram token error");
		throw new ORPCError("BAD_GATEWAY", { message: "Could not get streaming token" });
	}
	const data = (await response.json()) as {
		access_token: string;
		expires_in: number;
	};
	return { token: data.access_token, expiresInSec: data.expires_in };
}

/** AssemblyAI: short-lived streaming token via GET /v3/token (key stays server-side). */
export async function mintAssemblyaiToken(): Promise<MintedToken> {
	if (!env.ASSEMBLYAI_API_KEY) {
		throw new Error("AssemblyAI not configured. Set ASSEMBLYAI_API_KEY.");
	}
	let response: Response;
	try {
		response = await fetch(
			"https://streaming.assemblyai.com/v3/token?expires_in_seconds=60",
			{ headers: { authorization: env.ASSEMBLYAI_API_KEY } },
		);
	} catch (err) {
		logger.error({ err }, "AssemblyAI token request failed to send");
		throw new ORPCError("BAD_GATEWAY", {
			message: "Streaming token service unreachable",
		});
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		logger.error({ status: response.status, detail }, "AssemblyAI token error");
		throw new ORPCError("BAD_GATEWAY", { message: "Could not get streaming token" });
	}
	const data = (await response.json()) as {
		token: string;
		expires_in_seconds: number;
	};
	return { token: data.token, expiresInSec: data.expires_in_seconds };
}
