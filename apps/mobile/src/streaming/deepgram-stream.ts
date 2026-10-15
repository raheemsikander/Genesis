import type { OpenStream } from "./types";

const DEEPGRAM_WS_URL =
	"wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true";

// Deepgram authenticates header-less clients via the Sec-WebSocket-Protocol subprotocol.
// A short-lived /auth/grant JWT must use the "bearer" keyword (the "token" keyword is for
// raw API keys); with "token", Deepgram rejects the JWT and the socket closes with 1006.
export const openDeepgramStream: OpenStream = ({ token, onEvent }) => {
	const ws = new WebSocket(DEEPGRAM_WS_URL, ["bearer", token]);
	ws.binaryType = "arraybuffer";
	let keepAlive: ReturnType<typeof setInterval> | undefined;

	ws.onopen = () => {
		onEvent({ type: "open" });
		// Text control frames keep the socket alive during silence.
		keepAlive = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: "KeepAlive" }));
			}
		}, 8000);
	};
	ws.onmessage = (e) => {
		let msg: {
			type?: string;
			is_final?: boolean;
			channel?: { alternatives?: Array<{ transcript?: string }> };
		};
		try {
			msg = JSON.parse(e.data as string);
		} catch {
			onEvent({ type: "error", message: "Deepgram message parse error" });
			return;
		}
		if (msg.type !== "Results") return;
		const text = msg.channel?.alternatives?.[0]?.transcript ?? "";
		if (!text) return;
		onEvent({ type: msg.is_final ? "final" : "partial", text });
	};
	ws.onerror = () =>
		onEvent({ type: "error", message: "Deepgram connection error" });
	ws.onclose = () => {
		if (keepAlive) clearInterval(keepAlive);
		onEvent({ type: "closed" });
	};

	return {
		sendPcm: (data) => {
			if (ws.readyState === WebSocket.OPEN) ws.send(data);
		},
		close: () => {
			if (keepAlive) clearInterval(keepAlive);
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: "CloseStream" }));
			}
			ws.close();
		},
	};
};
