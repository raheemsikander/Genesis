import type { OpenStream } from "./types";

// Token is passed as a query param (RN WebSocket cannot set Authorization headers).
function wsUrl(token: string): string {
	return `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&encoding=pcm_s16le&format_turns=true&token=${encodeURIComponent(token)}`;
}

export const openAssemblyaiStream: OpenStream = ({ token, onEvent }) => {
	const ws = new WebSocket(wsUrl(token));
	ws.binaryType = "arraybuffer";

	ws.onmessage = (e) => {
		let msg: {
			type?: string;
			transcript?: string;
			end_of_turn?: boolean;
			turn_is_formatted?: boolean;
		};
		try {
			msg = JSON.parse(e.data as string);
		} catch {
			onEvent({ type: "error", message: "AssemblyAI message parse error" });
			return;
		}
		if (msg.type === "Begin") {
			onEvent({ type: "open" });
			return;
		}
		if (msg.type !== "Turn") return;
		const text = msg.transcript ?? "";
		if (!text) return;
		// With format_turns=true: commit only the formatted end-of-turn; everything
		// else is a live partial (avoids double-committing the unformatted final).
		const isFinal = msg.end_of_turn === true && msg.turn_is_formatted === true;
		onEvent({ type: isFinal ? "final" : "partial", text });
	};
	ws.onerror = () => onEvent({ type: "error", message: "AssemblyAI connection error" });
	ws.onclose = () => onEvent({ type: "closed" });

	return {
		sendPcm: (data) => {
			if (ws.readyState === WebSocket.OPEN) ws.send(data);
		},
		close: () => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: "Terminate" }));
			}
			ws.close();
		},
	};
};
