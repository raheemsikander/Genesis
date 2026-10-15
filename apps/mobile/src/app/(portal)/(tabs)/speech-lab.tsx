import type {
	TranscribeAudioResult,
	TranscriptionProvider,
} from "@repo/shared";
import { useAudioPlayer, useAudioStream } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import {
	ExpoSpeechRecognitionModule,
	useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	getStreamToken,
	transcribeAudioWith,
} from "../../../api/transcription.api";
import { Button, Card } from "../../../components/ui";
import { openAssemblyaiStream } from "../../../streaming/assemblyai-stream";
import { openDeepgramStream } from "../../../streaming/deepgram-stream";
import type { StreamingSession } from "../../../streaming/types";
import { Pressable, ScrollView, Text, TextInput, View } from "../../../tw";

/**
 * On-device transcription experiment (Expo-vs-bare evaluation, feature: voice note → text).
 *
 * Flow: record audio → speech-to-text → user edits the text → "send". Uses
 * `expo-speech-recognition` (wraps iOS SFSpeechRecognizer / Android SpeechRecognizer).
 * The `requiresOnDeviceRecognition` toggle is the lever we're testing: does the platform's
 * OFFLINE engine produce acceptable text (esp. on noisy / elderly speech) vs. its
 * network-backed mode? Whisper.rn is the fallback if on-device accuracy is too weak.
 *
 * The recorded audio is persisted (recordingOptions.persist) and played back via
 * `expo-audio` — useful to confirm the mic captured audio when STT returns nothing.
 */

const LANG = "en-US";

/**
 * Read a local file URI into a real native Blob.
 *
 * `fetch(uri).blob()` on React Native (whatwg-fetch) can hand back an ArrayBuffer-backed
 * body, and Blob/File construction then rejects it ("Creating blobs from 'ArrayBuffer'
 * and 'ArrayBufferView' are not supported"). XHR with responseType "blob" returns the
 * blob straight from the native blob module instead — and works for file:// URIs.
 */
function uriToBlob(uri: string): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.responseType = "blob";
		xhr.onload = () => resolve(xhr.response as Blob);
		xhr.onerror = () => reject(new Error("Could not read the audio file"));
		xhr.open("GET", uri, true);
		xhr.send(null);
	});
}

const PROVIDERS: { key: TranscriptionProvider; label: string }[] = [
	{ key: "deepgram", label: "Deepgram Nova-3" },
	{ key: "assemblyai", label: "AssemblyAI Universal-3 Pro" },
	{ key: "openai-gpt4o", label: "OpenAI gpt-4o-transcribe" },
	{ key: "openai-gpt4o-mini", label: "OpenAI gpt-4o-mini" },
	{ key: "speechmatics", label: "Speechmatics Enhanced" },
];

const LIVE_PROVIDERS = [
	{
		key: "deepgram" as const,
		label: "Deepgram Nova-3",
		open: openDeepgramStream,
	},
	{
		key: "assemblyai" as const,
		label: "AssemblyAI v3",
		open: openAssemblyaiStream,
	},
];

// ~100 ms of int16 mono @16 kHz = 3200 bytes. AssemblyAI needs 50–1000 ms chunks.
const PCM_FLUSH_BYTES = 3200;

type LivePane = {
	status: "connecting" | "live" | "error" | "closed";
	committed: string;
	partial: string;
	firstLatencyMs?: number;
	error?: string;
};

type RunState = {
	status: "pending" | "done" | "error";
	latencyMs?: number;
	result?: TranscribeAudioResult;
	error?: string;
};

type Mode = "ondevice" | "batch" | "live";

const MODES: { key: Mode; label: string }[] = [
	{ key: "ondevice", label: "On-device (live)" },
	{ key: "batch", label: "Cloud · compare engines" },
	{ key: "live", label: "Cloud · live stream" },
];

export default function SpeechLab() {
	const [mode, setMode] = useState<Mode>("ondevice");
	const [onDeviceOnly, setOnDeviceOnly] = useState(true);
	const [punctuation, setPunctuation] = useState(true);
	const [recognizing, setRecognizing] = useState(false);
	const [live, setLive] = useState("");
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [offlineInfo, setOfflineInfo] = useState<string | null>(null);
	const [servicesInfo, setServicesInfo] = useState<string | null>(null);
	const [recognizer, setRecognizer] = useState<string | null>(null);
	const [sentMsg, setSentMsg] = useState<string | null>(null);
	const [downloadMsg, setDownloadMsg] = useState<string | null>(null);
	const [downloading, setDownloading] = useState(false);
	const [recordedUri, setRecordedUri] = useState<string | null>(null);
	const [pickedType, setPickedType] = useState<string | null>(null);
	const [runs, setRuns] = useState<Record<string, RunState> | null>(null);
	const [running, setRunning] = useState(false);

	const [liveActive, setLiveActive] = useState(false);
	const [livePanes, setLivePanes] = useState<Record<string, LivePane> | null>(
		null,
	);
	const sessionsRef = useRef<StreamingSession[]>([]);
	const pcmChunksRef = useRef<Uint8Array[]>([]);
	const pcmBytesRef = useRef(0);
	const liveStartRef = useRef(0);

	const audioStream = useAudioStream({
		sampleRate: 16000,
		channels: 1,
		encoding: "int16",
		onBuffer: (buffer) => {
			pcmChunksRef.current.push(new Uint8Array(buffer.data));
			pcmBytesRef.current += buffer.data.byteLength;
			if (pcmBytesRef.current < PCM_FLUSH_BYTES) return;
			const merged = new Uint8Array(pcmBytesRef.current);
			let offset = 0;
			for (const chunk of pcmChunksRef.current) {
				merged.set(chunk, offset);
				offset += chunk.length;
			}
			pcmChunksRef.current = [];
			pcmBytesRef.current = 0;
			for (const session of sessionsRef.current) session.sendPcm(merged.buffer);
		},
	});

	const audioPlayer = useAudioPlayer(recordedUri ? { uri: recordedUri } : null);

	const liveRef = useRef("");
	function setLiveBoth(v: string) {
		liveRef.current = v;
		setLive(v);
	}
	function commit(t: string) {
		const clean = t.trim();
		if (!clean) return;
		setText((prev) => (prev.trim() ? `${prev.trim()} ${clean}` : clean));
		setLiveBoth("");
	}

	useSpeechRecognitionEvent("start", () => setRecognizing(true));
	useSpeechRecognitionEvent("end", () => {
		setRecognizing(false);
		if (liveRef.current.trim()) commit(liveRef.current);
	});
	useSpeechRecognitionEvent("result", (e) => {
		const t = e.results?.[0]?.transcript ?? "";
		if (e.isFinal) commit(t);
		else setLiveBoth(t);
	});
	useSpeechRecognitionEvent("error", (e) =>
		setError(`${e.error}: ${e.message}`),
	);
	// The persisted audio file path arrives on `audioend`.
	useSpeechRecognitionEvent("audioend", (e) => {
		if (e.uri) setRecordedUri(e.uri);
	});

	// Query the ON-DEVICE recognizer (Android System Intelligence, com.google.android.as)
	// for installed offline models — the on-device engine, not the Google-app/network one.
	const refreshOffline = useCallback(async () => {
		// Discover the device's actual recognizer and use it for everything below.
		let pkg = "com.google.android.tts";
		try {
			const services =
				ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
			const def = ExpoSpeechRecognitionModule.getDefaultRecognitionService();
			if (def?.packageName) pkg = def.packageName;
			setRecognizer(pkg);
			setServicesInfo(
				`Recognizers: ${services.length ? services.join(", ") : "none"} · default: ${pkg}`,
			);
		} catch {
			setServicesInfo(null);
		}
		try {
			const res = await ExpoSpeechRecognitionModule.getSupportedLocales({
				androidRecognitionServicePackage: pkg,
			});
			const installed = res.installedLocales ?? [];
			setOfflineInfo(
				installed.includes(LANG)
					? `Offline ${LANG} model: installed ✅`
					: `Offline ${LANG} model: NOT downloaded — tap "Download offline model" below`,
			);
		} catch {
			setOfflineInfo("Could not query offline locales on this device");
		}
	}, []);

	useEffect(() => {
		refreshOffline();
	}, [refreshOffline]);

	async function downloadModel() {
		setDownloading(true);
		setDownloadMsg(null);
		try {
			const result =
				await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
					locale: LANG,
				});
			setDownloadMsg(
				result.status === "download_success"
					? "Downloaded ✅ — turn on 'On-device only' and record"
					: result.status === "opened_dialog"
						? "System download dialog opened — finish it on the device, then re-open this tab"
						: `Download ${result.status}`,
			);
			await refreshOffline();
		} catch (e) {
			setDownloadMsg(e instanceof Error ? e.message : "Download failed");
		} finally {
			setDownloading(false);
		}
	}

	async function start() {
		setError(null);
		setSentMsg(null);
		const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
		if (!perm.granted) {
			setError("Microphone / speech-recognition permission not granted");
			return;
		}
		setLiveBoth("");
		setRecordedUri(null);
		setPickedType(null);
		setRuns(null);
		ExpoSpeechRecognitionModule.start({
			lang: LANG,
			interimResults: true,
			// Run until the user taps Stop. With `false`, Android endpoints on the first
			// short silence — the likely cause of "only a few words" / "no speech".
			continuous: true,
			requiresOnDeviceRecognition: onDeviceOnly,
			// Target the device's actual recognizer (e.g. com.google.android.tts),
			// discovered at mount. Network mode = this recognizer + requires=false.
			...(recognizer ? { androidRecognitionServicePackage: recognizer } : {}),
			// Punctuation on Android 13+ is only supported with on-device recognition.
			addsPunctuation: onDeviceOnly && punctuation,
			// Give the recognizer much longer to tolerate pauses before it gives up.
			androidIntentOptions: {
				EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 3000,
				EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 8000,
				EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 8000,
			},
			// Keep the captured audio on disk so we can play it back.
			recordingOptions: { persist: true },
		});
	}

	function stop() {
		ExpoSpeechRecognitionModule.stop();
	}

	function playRecording() {
		audioPlayer.seekTo(0);
		audioPlayer.play();
	}

	// Pick an existing audio file from the device. Exercises the same upload path as a
	// recording — handy for testing cloud transcription against known-good clips.
	async function pickAudio() {
		setError(null);
		setSentMsg(null);
		setRuns(null);
		const result = await DocumentPicker.getDocumentAsync({
			type: "audio/*",
			copyToCacheDirectory: true,
		});
		if (result.canceled) return;
		const asset = result.assets[0];
		if (!asset) return;
		setLiveBoth("");
		setPickedType(asset.mimeType ?? null);
		setRecordedUri(asset.uri);
	}

	// Fan out: transcribe the current clip with every engine in parallel, each result
	// landing independently so cards fill in as engines finish.
	async function runAll() {
		if (!recordedUri) return;
		setError(null);
		setRunning(true);
		setRuns(
			Object.fromEntries(PROVIDERS.map((p) => [p.key, { status: "pending" }])),
		);
		try {
			const ext = recordedUri.split(".").pop()?.toLowerCase() ?? "wav";
			const type =
				pickedType ??
				(ext === "caf"
					? "audio/x-caf"
					: ext === "m4a"
						? "audio/mp4"
						: "audio/wav");
			const raw = await uriToBlob(recordedUri);
			const blob = raw.type ? raw : raw.slice(0, raw.size, type);
			const file = Object.assign(blob, {
				name: `audio.${ext}`,
			}) as unknown as File;

			await Promise.allSettled(
				PROVIDERS.map(async ({ key }) => {
					const startedAt = Date.now();
					try {
						const result = await transcribeAudioWith(file, key);
						setRuns((prev) => ({
							...prev,
							[key]: {
								status: "done",
								latencyMs: Date.now() - startedAt,
								result,
							},
						}));
					} catch (e) {
						setRuns((prev) => ({
							...prev,
							[key]: {
								status: "error",
								latencyMs: Date.now() - startedAt,
								error: e instanceof Error ? e.message : "failed",
							},
						}));
					}
				}),
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not read the clip");
		} finally {
			setRunning(false);
		}
	}

	function send() {
		const clean = text.trim();
		if (!clean) return;
		// Experiment stand-in for a real send (would POST to the server).
		setSentMsg(
			`Sent ${clean.length} chars: "${clean.slice(0, 60)}${clean.length > 60 ? "…" : ""}"`,
		);
	}

	function clearAll() {
		setText("");
		setLiveBoth("");
		setSentMsg(null);
		setError(null);
		setRecordedUri(null);
		setPickedType(null);
		setRuns(null);
	}

	function updatePane(key: string, patch: Partial<LivePane>) {
		setLivePanes((prev) => ({
			...prev,
			[key]: {
				...(prev?.[key] ?? {
					status: "connecting",
					committed: "",
					partial: "",
				}),
				...patch,
			},
		}));
	}

	async function startLive() {
		setError(null);
		const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
		if (!perm.granted) {
			setError("Microphone permission not granted");
			return;
		}
		setLivePanes(
			Object.fromEntries(
				LIVE_PROVIDERS.map((p) => [
					p.key,
					{ status: "connecting", committed: "", partial: "" },
				]),
			),
		);
		setLiveActive(true);
		const sessionResults = await Promise.all(
			LIVE_PROVIDERS.map(async (provider) => {
				try {
					const { token } = await getStreamToken(provider.key);
					const session = provider.open({
						token,
						onEvent: (event) => {
							if (event.type === "open")
								updatePane(provider.key, { status: "live" });
							else if (event.type === "partial") {
								setLivePanes((prev) => {
									const pane = prev?.[provider.key];
									return {
										...prev,
										[provider.key]: {
											...(pane ?? {
												status: "live",
												committed: "",
												partial: "",
											}),
											status: "live",
											partial: event.text,
											firstLatencyMs:
												pane?.firstLatencyMs ??
												Date.now() - liveStartRef.current,
										},
									};
								});
							} else if (event.type === "final")
								setLivePanes((prev) => {
									const pane = prev?.[provider.key];
									const committed =
										`${pane?.committed ?? ""} ${event.text}`.trim();
									return {
										...prev,
										[provider.key]: {
											...(pane ?? {
												status: "live",
												committed: "",
												partial: "",
											}),
											committed,
											partial: "",
										},
									};
								});
							else if (event.type === "error")
								updatePane(provider.key, {
									status: "error",
									error: event.message,
								});
							else if (event.type === "closed")
								updatePane(provider.key, { status: "closed" });
						},
					});
					return session;
				} catch (e) {
					updatePane(provider.key, {
						status: "error",
						error: e instanceof Error ? e.message : "Could not start",
					});
					return null;
				}
			}),
		);
		const sessions = sessionResults.filter(
			(s): s is StreamingSession => s !== null,
		);
		sessionsRef.current = sessions;
		if (sessions.length > 0) {
			liveStartRef.current = Date.now();
			audioStream.stream.start();
		}
	}

	function stopLive() {
		audioStream.stream.stop();
		for (const session of sessionsRef.current) session.close();
		sessionsRef.current = [];
		pcmChunksRef.current = [];
		pcmBytesRef.current = 0;
		setLiveActive(false);
	}

	function handleModeChange(next: Mode) {
		setMode(next);
		setError(null);
	}

	return (
		<ScrollView
			className="flex-1 bg-background"
			contentContainerClassName="gap-4 p-5"
		>
			{/* Mode selector */}
			<View className="flex-row rounded-md bg-muted p-1">
				{MODES.map(({ key, label }) => (
					<Pressable
						key={key}
						className={`flex-1 items-center rounded-md px-2 py-2 ${mode === key ? "bg-background" : ""}`}
						onPress={() => handleModeChange(key)}
					>
						<Text
							className={`text-center text-xs ${mode === key ? "font-medium text-foreground" : "text-muted-foreground"}`}
						>
							{label}
						</Text>
					</Pressable>
				))}
			</View>

			{/* Error — visible across all modes */}
			{error ? (
				<Text className="text-destructive text-sm" selectable>
					{error}
				</Text>
			) : null}

			{/* ── On-device (live) ─────────────────────────────────────────────── */}
			{mode === "ondevice" && (
				<>
					<Card>
						<Text className="pb-1 font-medium text-base text-foreground">
							On-device speech-to-text
						</Text>
						{offlineInfo ? (
							<Text className="pb-1 text-muted-foreground text-xs" selectable>
								{offlineInfo}
							</Text>
						) : null}
						{servicesInfo ? (
							<Text className="pb-2 text-muted-foreground text-xs" selectable>
								{servicesInfo}
							</Text>
						) : null}
						<Button
							tone="muted"
							variant="outline"
							onPress={downloadModel}
							loading={downloading}
							disabled={downloading || recognizing}
						>
							Download offline model (en-US)
						</Button>
						{downloadMsg ? (
							<Text className="pt-2 text-muted-foreground text-xs" selectable>
								{downloadMsg}
							</Text>
						) : null}
					</Card>

					<Toggle
						label="On-device only"
						hint="requiresOnDeviceRecognition — no audio leaves the phone"
						value={onDeviceOnly}
						onToggle={() => setOnDeviceOnly((v) => !v)}
						disabled={recognizing}
					/>
					<Toggle
						label="Add punctuation"
						hint="addsPunctuation (Android 13+ needs on-device)"
						value={punctuation}
						onToggle={() => setPunctuation((v) => !v)}
						disabled={recognizing}
					/>

					<Button
						tone={recognizing ? "destructive" : "primary"}
						onPress={recognizing ? stop : start}
					>
						{recognizing ? "Stop" : "Record & transcribe"}
					</Button>

					{recognizing || live ? (
						<View className="rounded-md border border-border p-3">
							<Text className="pb-1 text-muted-foreground text-xs uppercase">
								{recognizing ? "Listening…" : "Live"}
							</Text>
							<Text className="text-foreground text-sm">
								{live || "Speak now…"}
							</Text>
						</View>
					) : null}

					<View className="gap-2">
						<Text className="text-muted-foreground text-xs uppercase">
							Transcript (editable)
						</Text>
						<TextInput
							className="min-h-24 rounded-md border border-input bg-card p-3 text-base text-foreground"
							value={text}
							onChangeText={setText}
							multiline
							textAlignVertical="top"
							placeholder="Your transcribed text appears here — edit before sending."
							placeholderTextColor="#9ca3af"
						/>
					</View>

					<View className="flex-row gap-2">
						<View className="flex-1">
							<Button onPress={send} disabled={!text.trim() || recognizing}>
								Send
							</Button>
						</View>
						<View className="flex-1">
							<Button
								tone="muted"
								variant="outline"
								onPress={clearAll}
								disabled={recognizing}
							>
								Clear
							</Button>
						</View>
					</View>

					{sentMsg ? (
						<Text className="text-sm text-success-foreground" selectable>
							{sentMsg}
						</Text>
					) : null}
				</>
			)}

			{/* ── Cloud · compare engines (batch) ──────────────────────────────── */}
			{mode === "batch" && (
				<>
					<Button
						tone={recognizing ? "destructive" : "primary"}
						onPress={recognizing ? stop : start}
					>
						{recognizing ? "Stop" : "Record clip"}
					</Button>

					<Button
						tone="muted"
						variant="outline"
						onPress={pickAudio}
						disabled={recognizing}
					>
						Pick audio file (test cloud)
					</Button>

					{recordedUri ? (
						<View className="gap-2 rounded-md border border-border p-3">
							<Text className="text-muted-foreground text-xs uppercase">
								Audio clip
							</Text>
							<Button tone="muted" variant="outline" onPress={playRecording}>
								▶ Play recording
							</Button>
							<Button onPress={runAll} loading={running} disabled={running}>
								Run all engines
							</Button>
						</View>
					) : null}

					{runs ? (
						<View className="gap-2">
							<Text className="text-muted-foreground text-xs uppercase">
								Engine comparison
							</Text>
							{PROVIDERS.map(({ key, label }) => {
								const run = runs[key];
								return (
									<View
										key={key}
										className="gap-1 rounded-md border border-border p-3"
									>
										<View className="flex-row items-center justify-between">
											<Text className="font-medium text-foreground text-sm">
												{label}
											</Text>
											<Text className="text-muted-foreground text-xs">
												{run?.status === "pending"
													? "…"
													: run?.latencyMs != null
														? `${(run.latencyMs / 1000).toFixed(1)}s`
														: ""}
											</Text>
										</View>
										{run?.status === "done" && run.result ? (
											<>
												<Text className="text-muted-foreground text-xs">
													{run.result.model}
													{run.result.confidence != null
														? ` · ${Math.round(run.result.confidence * 100)}% conf`
														: ""}
												</Text>
												<Text className="text-foreground text-sm" selectable>
													{run.result.transcript || "(empty)"}
												</Text>
											</>
										) : run?.status === "error" ? (
											<Text className="text-destructive text-xs" selectable>
												{run.error}
											</Text>
										) : (
											<Text className="text-muted-foreground text-sm">
												Transcribing…
											</Text>
										)}
									</View>
								);
							})}
						</View>
					) : null}
				</>
			)}

			{/* ── Cloud · live stream ───────────────────────────────────────────── */}
			{mode === "live" && (
				<>
					<Button
						tone={liveActive ? "destructive" : "primary"}
						onPress={liveActive ? stopLive : startLive}
					>
						{liveActive
							? "Stop live"
							: "Live transcribe (Deepgram + AssemblyAI)"}
					</Button>

					{livePanes ? (
						<View className="gap-2">
							{LIVE_PROVIDERS.map(({ key, label }) => {
								const pane = livePanes[key];
								return (
									<View
										key={key}
										className="gap-1 rounded-md border border-border p-3"
									>
										<View className="flex-row items-center justify-between">
											<Text className="font-medium text-foreground text-sm">
												{label}
											</Text>
											<Text className="text-muted-foreground text-xs">
												{pane?.status}
												{pane?.firstLatencyMs != null
													? ` · first word ${(pane.firstLatencyMs / 1000).toFixed(1)}s`
													: ""}
											</Text>
										</View>
										{pane?.status === "error" ? (
											<Text className="text-destructive text-xs" selectable>
												{pane.error}
											</Text>
										) : (
											<Text className="text-foreground text-sm" selectable>
												{pane?.committed}
												{pane?.partial ? (
													<Text className="text-muted-foreground">
														{" "}
														{pane.partial}
													</Text>
												) : null}
												{!pane?.committed && !pane?.partial ? "…" : ""}
											</Text>
										)}
									</View>
								);
							})}
						</View>
					) : null}
				</>
			)}
		</ScrollView>
	);
}

function Toggle({
	label,
	hint,
	value,
	onToggle,
	disabled,
}: {
	label: string;
	hint: string;
	value: boolean;
	onToggle: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			className="flex-row items-center justify-between rounded-md border border-border p-3"
			onPress={onToggle}
			disabled={disabled}
		>
			<View className="flex-1 pr-2">
				<Text className="text-foreground text-sm">{label}</Text>
				<Text className="text-muted-foreground text-xs">{hint}</Text>
			</View>
			<View
				className={`size-6 items-center justify-center rounded-md border ${value ? "border-primary bg-primary" : "border-border"}`}
			>
				{value ? (
					<Text className="text-primary-foreground text-xs">✓</Text>
				) : null}
			</View>
		</Pressable>
	);
}
