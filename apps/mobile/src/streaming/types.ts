export type StreamEvent =
	| { type: "open" }
	| { type: "partial"; text: string }
	| { type: "final"; text: string }
	| { type: "error"; message: string }
	| { type: "closed" };

export type StreamingSession = {
	/** Send one binary PCM frame (int16 LE, 16 kHz mono). */
	sendPcm: (data: ArrayBuffer) => void;
	/** Finalize and close the socket. */
	close: () => void;
};

export type OpenStream = (opts: {
	token: string;
	onEvent: (event: StreamEvent) => void;
}) => StreamingSession;
