import {
	type CameraType,
	CameraView,
	useCameraPermissions,
	useMicrophonePermissions,
	type VideoQuality,
} from "expo-camera";
import { File as FsFile } from "expo-file-system";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { Video } from "react-native-compressor";
import {
	Camera,
	type CameraPosition,
	CommonResolutions,
	type Recorder,
	useCameraDevice,
	useCameraPermission,
	useMicrophonePermission,
	VisionCamera,
} from "react-native-vision-camera";
import { useUploadFile } from "../../../api/storage.api";
import { Button, Card } from "../../../components/ui";
import { Pressable, ScrollView, Text, View } from "../../../tw";

/**
 * Expo-vs-bare video experiment harness — now with two recording engines.
 *
 * `expo-camera` engine (original): record raw, then optionally re-encode with
 * `react-native-compressor`. Proves how far Expo's first-party camera gets, and that the
 * record-time `videoBitrate` prop is only a soft hint on Android (asked 2 Mbps, got ~9).
 *
 * `react-native-vision-camera` (v5 / Nitro) engine: the record-time lever expo-camera lacked.
 * `useVideoOutput({ targetBitRate, targetResolution })` caps the encoder AT CAPTURE, so the
 * file is born small with NO post-record compression pass and NO wait — regardless of clip
 * length. HD / Standard presets are chosen BEFORE recording (you cannot re-pick after, since
 * there is no transcode to re-pick into). Codec is device-selected on Android (v5's codec
 * control is iOS-only), so we measure size/bitrate rather than dictate the codec.
 *
 * Both engines feed the same oRPC storage upload, exercising the full record -> upload loop.
 */

const SHORT_DURATION_SEC = 30;
const LONG_DURATION_SEC = 300; // 5 minutes — for long test recordings.
const BITRATE_CAP = 2_000_000; // 2 Mbps — expo-camera manual-compress target.

// VisionCamera record-time presets. targetBitRate is in bits/sec; the encoder treats it as a
// reference, not a hard cap. Resolutions come from VisionCamera's CommonResolutions (16:9).
const VISION_PRESETS = {
	standard: {
		label: "Standard",
		sub: "480p · ~1.5 Mbps",
		resolution: CommonResolutions.VGA_16_9,
		bitRate: 1_500_000,
	},
	hd: {
		label: "HD",
		sub: "720p · ~5 Mbps",
		resolution: CommonResolutions.HD_16_9,
		bitRate: 5_000_000,
	},
} as const;

type PresetKey = keyof typeof VISION_PRESETS;

// expo-camera equivalents of the same profiles. videoQuality selects the resolution tier;
// videoBitrate is the record-time cap (a soft hint on Android — it holds at 480p but is
// floored to ~5 Mbps at 720p by the encoder's minquality, same as VisionCamera).
const EXPO_PRESETS = {
	standard: {
		label: "Standard",
		sub: "480p · ~1.5 Mbps",
		quality: "480p",
		bitRate: 1_500_000,
	},
	hd: {
		label: "HD",
		sub: "720p · ~5 Mbps",
		quality: "720p",
		bitRate: 5_000_000,
	},
} satisfies Record<
	PresetKey,
	{ label: string; sub: string; quality: VideoQuality; bitRate: number }
>;

type CompressMethod = "auto" | "manual";

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function effectiveMbps(bytes: number, seconds: number): string {
	if (seconds <= 0) return "—";
	return `${((bytes * 8) / seconds / 1_000_000).toFixed(2)} Mbps`;
}

/** Upload a local file URI through the same oRPC storage path the web app uses. */
async function uploadVideo(
	uploadFile: (input: { file: File }) => Promise<unknown>,
	uri: string,
	sizeBytes: number,
): Promise<string> {
	const response = await fetch(uri);
	const blob = await response.blob();
	const name = `lab-clip-${Date.now()}.mp4`;
	const type = blob.type || "video/mp4";
	const file =
		typeof File !== "undefined"
			? new File([blob], name, { type })
			: (Object.assign(blob, { name }) as unknown as File);
	await uploadFile({ file });
	return `Uploaded ${formatSize(sizeBytes)} to S3.`;
}

export default function VideoLab() {
	const [engine, setEngine] = useState<"vision" | "expo">("vision");

	return (
		<View className="flex-1 bg-background">
			<View className="flex-row gap-2 p-5 pb-0">
				<View className="flex-1">
					<Button
						tone={engine === "vision" ? "primary" : "muted"}
						variant={engine === "vision" ? "solid" : "outline"}
						onPress={() => setEngine("vision")}
					>
						VisionCamera
					</Button>
				</View>
				<View className="flex-1">
					<Button
						tone={engine === "expo" ? "primary" : "muted"}
						variant={engine === "expo" ? "solid" : "outline"}
						onPress={() => setEngine("expo")}
					>
						expo-camera
					</Button>
				</View>
			</View>
			{engine === "vision" ? <VisionCameraLab /> : <ExpoCameraLab />}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* VisionCamera engine — record-time bitrate presets (the no-wait path)        */
/* -------------------------------------------------------------------------- */

type VisionResult = {
	uri: string;
	sizeBytes: number;
	durationSec: number;
	preset: PresetKey;
	targetBitRate: number;
	wideBitrate: boolean;
};

function VisionCameraLab() {
	const camPerm = useCameraPermission();
	const micPerm = useMicrophonePermission();
	const upload = useUploadFile();

	const [facing, setFacing] = useState<CameraPosition>("back");
	const [preset, setPreset] = useState<PresetKey>("standard");
	const [wideBitrate, setWideBitrate] = useState(true);
	const [longRecording, setLongRecording] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [cameraReady, setCameraReady] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [result, setResult] = useState<VisionResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [uploadMsg, setUploadMsg] = useState<string | null>(null);

	const device = useCameraDevice(facing);
	const presetCfg = VISION_PRESETS[preset];
	// NOTE: the useVideoOutput hook in v5.0.11 silently drops enableHigherResolutionCodecs
	// (it isn't forwarded to createVideoOutput), so we build the output imperatively to
	// actually exercise it. CAMCORDER_PROFILE (default) clamps the target bitrate to the
	// device's recording-profile floor (~5 Mbps at 720p). CODEC_CAPABILITIES exposes the
	// encoder's full bitrate range so a low target can actually stick — at the cost of
	// device-specific stability. We toggle it to measure both.
	const videoOutput = useMemo(
		() =>
			VisionCamera.createVideoOutput({
				targetResolution: presetCfg.resolution,
				targetBitRate: presetCfg.bitRate,
				enableHigherResolutionCodecs: wideBitrate,
				enableAudio: true,
			}),
		[presetCfg.resolution, presetCfg.bitRate, wideBitrate],
	);

	const recorderRef = useRef<Recorder | null>(null);
	const startedAtRef = useRef(0);

	const player = useVideoPlayer(result?.uri ?? null, (p) => {
		p.loop = true;
	});

	useEffect(() => {
		if (!isRecording) return;
		const id = setInterval(() => {
			setElapsed((Date.now() - startedAtRef.current) / 1000);
		}, 100);
		return () => clearInterval(id);
	}, [isRecording]);

	const granted = camPerm.hasPermission && micPerm.hasPermission;
	const maxDuration = longRecording ? LONG_DURATION_SEC : SHORT_DURATION_SEC;
	// WhatsApp-style instant size estimate: target bitrate × max duration.
	const estBytes = (presetCfg.bitRate * maxDuration) / 8;

	async function startRecording() {
		if (isRecording || !cameraReady) return;
		setError(null);
		setResult(null);
		setUploadMsg(null);
		setElapsed(0);
		try {
			const recorder = await videoOutput.createRecorder({ maxDuration });
			recorderRef.current = recorder;
			startedAtRef.current = Date.now();
			setIsRecording(true);
			await recorder.startRecording(
				(filePath) => {
					// VisionCamera returns a filesystem path; expo-file-system / fetch need file://.
					const uri = filePath.startsWith("file://")
						? filePath
						: `file://${filePath}`;
					const durationSec = (Date.now() - startedAtRef.current) / 1000;
					const sizeBytes = new FsFile(uri).size ?? 0;
					setResult({
						uri,
						sizeBytes,
						durationSec,
						preset,
						targetBitRate: presetCfg.bitRate,
						wideBitrate,
					});
					setIsRecording(false);
					recorderRef.current = null;
				},
				(err) => {
					setError(err.message);
					setIsRecording(false);
					recorderRef.current = null;
				},
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Recording failed");
			setIsRecording(false);
			recorderRef.current = null;
		}
	}

	function stopRecording() {
		void recorderRef.current?.stopRecording();
	}

	async function uploadCurrent() {
		if (!result) return;
		setUploadMsg(null);
		try {
			const msg = await uploadVideo(
				upload.mutateAsync,
				result.uri,
				result.sizeBytes,
			);
			setUploadMsg(msg);
		} catch (e) {
			setUploadMsg(e instanceof Error ? e.message : "Upload failed");
		}
	}

	function reset() {
		setResult(null);
		setUploadMsg(null);
		setError(null);
		setElapsed(0);
	}

	if (!granted) {
		return (
			<View className="flex-1 items-center justify-center gap-4 bg-background p-6">
				<Text className="text-center text-base text-foreground">
					Camera and microphone access are required to record video.
				</Text>
				<Button
					onPress={() => {
						void camPerm.requestPermission();
						void micPerm.requestPermission();
					}}
				>
					Grant permissions
				</Button>
			</View>
		);
	}

	return (
		<ScrollView
			className="flex-1 bg-background"
			contentContainerClassName="gap-4 p-5"
		>
			<View
				className="w-full overflow-hidden rounded-md bg-black"
				style={{ height: 360 }}
			>
				{result ? (
					<VideoView
						player={player}
						style={{ flex: 1 }}
						nativeControls
						contentFit="contain"
					/>
				) : device ? (
					<Camera
						style={{ flex: 1 }}
						device={device}
						isActive={true}
						outputs={[videoOutput]}
						onPreviewStarted={() => setCameraReady(true)}
						onPreviewStopped={() => setCameraReady(false)}
					/>
				) : (
					<View className="flex-1 items-center justify-center">
						<Text className="text-muted-foreground text-sm">
							No {facing} camera device found.
						</Text>
					</View>
				)}
				{isRecording ? (
					<View className="absolute top-3 left-3 flex-row items-center gap-2 rounded-md bg-destructive px-2 py-1">
						<View className="size-2 rounded-md bg-destructive-foreground" />
						<Text
							className="text-destructive-foreground text-xs"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							REC {elapsed.toFixed(1)}s
						</Text>
					</View>
				) : null}
			</View>

			{error ? (
				<Text className="text-destructive text-sm" selectable>
					{error}
				</Text>
			) : null}

			{result ? (
				<>
					<Card>
						<Text className="pb-2 font-medium text-base text-foreground">
							Recorded at {VISION_PRESETS[result.preset].label} (record-time
							bitrate)
						</Text>
						<ResultRow
							label="Target bitrate"
							value={`${(result.targetBitRate / 1_000_000).toFixed(2)} Mbps`}
						/>
						<ResultRow
							label="Bitrate source"
							value={result.wideBitrate ? "codec caps" : "camcorder profile"}
						/>
						<ResultRow label="File size" value={formatSize(result.sizeBytes)} />
						<ResultRow
							label="Duration"
							value={`${result.durationSec.toFixed(1)}s`}
						/>
						<ResultRow
							label="Effective bitrate"
							value={effectiveMbps(result.sizeBytes, result.durationSec)}
						/>
						<Text className="pt-2 text-muted-foreground text-xs">
							Born at this size — no compression pass, no wait. Codec is
							device-selected (Android).
						</Text>
					</Card>

					<Button
						onPress={uploadCurrent}
						loading={upload.isPending}
						disabled={upload.isPending}
					>
						Upload to S3
					</Button>
					{uploadMsg ? (
						<Text className="text-muted-foreground text-sm" selectable>
							{uploadMsg}
						</Text>
					) : null}

					<Button tone="muted" variant="outline" onPress={reset}>
						Record again
					</Button>
				</>
			) : (
				<>
					<View className="gap-2">
						<Text className="text-muted-foreground text-xs uppercase">
							Preset (chosen before recording)
						</Text>
						<View className="flex-row gap-2">
							{(Object.keys(VISION_PRESETS) as PresetKey[]).map((key) => (
								<View key={key} className="flex-1">
									<Button
										tone={preset === key ? "primary" : "muted"}
										variant={preset === key ? "solid" : "outline"}
										onPress={() => setPreset(key)}
										disabled={isRecording}
									>
										{VISION_PRESETS[key].label}
									</Button>
								</View>
							))}
						</View>
						<Text className="text-muted-foreground text-xs">
							{presetCfg.sub} · ~{formatSize(estBytes)} est. for {maxDuration}s
						</Text>
					</View>

					<Pressable
						className="flex-row items-center justify-between rounded-md border border-border p-3"
						onPress={() => setWideBitrate((v) => !v)}
						disabled={isRecording}
					>
						<View className="flex-1 pr-2">
							<Text className="text-foreground text-sm">
								Wide bitrate range (codec caps)
							</Text>
							<Text className="text-muted-foreground text-xs">
								CODEC_CAPABILITIES vs CamcorderProfile — lets the low target
								bitrate actually apply
							</Text>
						</View>
						<View
							className={`size-6 items-center justify-center rounded-md border ${wideBitrate ? "border-primary bg-primary" : "border-border"}`}
						>
							{wideBitrate ? (
								<Text className="text-primary-foreground text-xs">✓</Text>
							) : null}
						</View>
					</Pressable>

					<Pressable
						className="flex-row items-center justify-between rounded-md border border-border p-3"
						onPress={() => setLongRecording((v) => !v)}
						disabled={isRecording}
					>
						<View className="flex-1 pr-2">
							<Text className="text-foreground text-sm">
								Long recording (5 min)
							</Text>
							<Text className="text-muted-foreground text-xs">
								Raises the max clip from 30s to 5 min
							</Text>
						</View>
						<View
							className={`size-6 items-center justify-center rounded-md border ${longRecording ? "border-primary bg-primary" : "border-border"}`}
						>
							{longRecording ? (
								<Text className="text-primary-foreground text-xs">✓</Text>
							) : null}
						</View>
					</Pressable>

					<View className="flex-row gap-2">
						<View className="flex-1">
							<Button
								tone={isRecording ? "destructive" : "primary"}
								onPress={isRecording ? stopRecording : startRecording}
								disabled={!isRecording && !cameraReady}
							>
								{isRecording ? "Stop" : "Record"}
							</Button>
						</View>
						<Pressable
							className="items-center justify-center rounded-md border border-border px-4"
							onPress={() =>
								setFacing((f) => (f === "back" ? "front" : "back"))
							}
							disabled={isRecording}
						>
							<Text className="text-foreground text-sm">Flip</Text>
						</Pressable>
					</View>

					<Text className="text-muted-foreground text-xs">
						Max {maxDuration}s per clip. Recording stops automatically at the
						limit.
						{cameraReady ? "" : " Waiting for camera…"}
					</Text>
				</>
			)}
		</ScrollView>
	);
}

/* -------------------------------------------------------------------------- */
/* expo-camera engine — raw record + react-native-compressor (original path)   */
/* -------------------------------------------------------------------------- */

type RecordingResult = {
	uri: string;
	sizeBytes: number;
	durationSec: number;
	preset: PresetKey;
	quality: VideoQuality;
	targetBitRate: number;
};

type CompressResult = {
	uri: string;
	sizeBytes: number;
	method: CompressMethod;
	elapsedSec: number;
	originalBytes: number;
};

function ExpoCameraLab() {
	const [cameraPermission, requestCamera] = useCameraPermissions();
	const [micPermission, requestMic] = useMicrophonePermissions();
	const cameraRef = useRef<CameraView>(null);
	const upload = useUploadFile();

	const [facing, setFacing] = useState<CameraType>("back");
	const [preset, setPreset] = useState<PresetKey>("standard");
	const [longRecording, setLongRecording] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [result, setResult] = useState<RecordingResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [compressing, setCompressing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [compressed, setCompressed] = useState<CompressResult | null>(null);
	const [playSource, setPlaySource] = useState<"raw" | "compressed">("raw");
	const [uploadMsg, setUploadMsg] = useState<string | null>(null);

	const startedAtRef = useRef(0);
	const playbackUri =
		playSource === "compressed" && compressed
			? compressed.uri
			: (result?.uri ?? null);
	const player = useVideoPlayer(playbackUri, (p) => {
		p.loop = true;
	});

	useEffect(() => {
		if (!isRecording) return;
		const id = setInterval(() => {
			setElapsed((Date.now() - startedAtRef.current) / 1000);
		}, 100);
		return () => clearInterval(id);
	}, [isRecording]);

	const granted = cameraPermission?.granted && micPermission?.granted;

	async function requestAll() {
		await requestCamera();
		await requestMic();
	}

	async function startRecording() {
		if (!cameraRef.current || isRecording) return;
		setError(null);
		setResult(null);
		setCompressed(null);
		setPlaySource("raw");
		setUploadMsg(null);
		setElapsed(0);
		setIsRecording(true);
		startedAtRef.current = Date.now();
		try {
			const video = await cameraRef.current.recordAsync({
				maxDuration: longRecording ? LONG_DURATION_SEC : SHORT_DURATION_SEC,
			});
			if (video?.uri) {
				const durationSec = (Date.now() - startedAtRef.current) / 1000;
				const sizeBytes = new FsFile(video.uri).size ?? 0;
				setResult({
					uri: video.uri,
					sizeBytes,
					durationSec,
					preset,
					quality: EXPO_PRESETS[preset].quality,
					targetBitRate: EXPO_PRESETS[preset].bitRate,
				});
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Recording failed");
		} finally {
			setIsRecording(false);
		}
	}

	function stopRecording() {
		cameraRef.current?.stopRecording();
	}

	async function compress(method: CompressMethod) {
		if (!result || compressing) return;
		setError(null);
		setUploadMsg(null);
		setCompressing(true);
		setProgress(0);
		const startedAt = Date.now();
		try {
			const uri = await Video.compress(
				result.uri,
				method === "auto"
					? { compressionMethod: "auto" }
					: {
							compressionMethod: "manual",
							bitrate: BITRATE_CAP,
							maxSize: 1280,
						},
				(p) => setProgress(p),
			);
			const sizeBytes = new FsFile(uri).size ?? 0;
			setCompressed({
				uri,
				sizeBytes,
				method,
				elapsedSec: (Date.now() - startedAt) / 1000,
				originalBytes: result.sizeBytes,
			});
			setPlaySource("compressed");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Compression failed");
		} finally {
			setCompressing(false);
		}
	}

	async function uploadCurrent() {
		const target =
			playSource === "compressed" && compressed ? compressed : result;
		if (!target) return;
		setUploadMsg(null);
		setError(null);
		try {
			const msg = await uploadVideo(
				upload.mutateAsync,
				target.uri,
				target.sizeBytes,
			);
			setUploadMsg(msg);
		} catch (e) {
			setUploadMsg(e instanceof Error ? e.message : "Upload failed");
		}
	}

	function reset() {
		setResult(null);
		setCompressed(null);
		setPlaySource("raw");
		setUploadMsg(null);
		setError(null);
		setProgress(0);
		setElapsed(0);
	}

	if (!cameraPermission || !micPermission) {
		return (
			<View className="flex-1 items-center justify-center bg-background p-6">
				<Text className="text-muted-foreground">Checking permissions…</Text>
			</View>
		);
	}

	if (!granted) {
		return (
			<View className="flex-1 items-center justify-center gap-4 bg-background p-6">
				<Text className="text-center text-base text-foreground">
					Camera and microphone access are required to record video.
				</Text>
				<Button onPress={requestAll}>Grant permissions</Button>
			</View>
		);
	}

	return (
		<ScrollView
			className="flex-1 bg-background"
			contentContainerClassName="gap-4 p-5"
		>
			{/* Preview: live camera until we have a result, then playback of the selected clip. */}
			<View
				className="w-full overflow-hidden rounded-md bg-black"
				style={{ height: 360 }}
			>
				{result ? (
					<VideoView
						player={player}
						style={{ flex: 1 }}
						nativeControls
						contentFit="contain"
					/>
				) : (
					<CameraView
						ref={cameraRef}
						mode="video"
						facing={facing}
						videoQuality={EXPO_PRESETS[preset].quality}
						videoBitrate={EXPO_PRESETS[preset].bitRate}
						style={{ flex: 1 }}
					/>
				)}
				{isRecording ? (
					<View className="absolute top-3 left-3 flex-row items-center gap-2 rounded-md bg-destructive px-2 py-1">
						<View className="size-2 rounded-md bg-destructive-foreground" />
						<Text
							className="text-destructive-foreground text-xs"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							REC {elapsed.toFixed(1)}s
						</Text>
					</View>
				) : null}
			</View>

			{error ? (
				<Text className="text-destructive text-sm" selectable>
					{error}
				</Text>
			) : null}

			{result ? (
				<>
					{/* Raw recording stats */}
					<Card>
						<Text className="pb-2 font-medium text-base text-foreground">
							Recorded at {EXPO_PRESETS[result.preset].label} (record-time cap)
						</Text>
						<ResultRow label="Quality" value={result.quality} />
						<ResultRow
							label="Target bitrate"
							value={`${(result.targetBitRate / 1_000_000).toFixed(2)} Mbps`}
						/>
						<ResultRow label="File size" value={formatSize(result.sizeBytes)} />
						<ResultRow
							label="Duration"
							value={`${result.durationSec.toFixed(1)}s`}
						/>
						<ResultRow
							label="Effective bitrate"
							value={effectiveMbps(result.sizeBytes, result.durationSec)}
						/>
					</Card>

					{/* Phase B — Lever B: post-recording compression */}
					<Card>
						<Text className="pb-1 font-medium text-base text-foreground">
							Compress (react-native-compressor)
						</Text>
						{compressing ? (
							<Text className="pb-2 text-muted-foreground text-sm">
								Compressing… {Math.round(progress * 100)}%
							</Text>
						) : null}
						<View className="flex-row gap-2 pb-1">
							<View className="flex-1">
								<Button
									tone="muted"
									variant="outline"
									onPress={() => compress("auto")}
									loading={compressing}
									disabled={compressing}
								>
									Auto
								</Button>
							</View>
							<View className="flex-1">
								<Button
									tone="muted"
									variant="outline"
									onPress={() => compress("manual")}
									loading={compressing}
									disabled={compressing}
								>
									Manual 2 Mbps
								</Button>
							</View>
						</View>
						{compressed ? (
							<View className="pt-1">
								<ResultRow label="Method" value={compressed.method} />
								<ResultRow
									label="Compressed size"
									value={formatSize(compressed.sizeBytes)}
								/>
								<ResultRow
									label="Reduction"
									value={`${(100 - (compressed.sizeBytes / compressed.originalBytes) * 100).toFixed(1)}% smaller`}
								/>
								<ResultRow
									label="Compression time"
									value={`${compressed.elapsedSec.toFixed(1)}s`}
								/>
								<ResultRow
									label="Bitrate"
									value={effectiveMbps(
										compressed.sizeBytes,
										result.durationSec,
									)}
								/>
							</View>
						) : null}
					</Card>

					{/* Playback toggle + upload (full loop) */}
					<View className="flex-row gap-2">
						<View className="flex-1">
							<Button
								tone={playSource === "raw" ? "primary" : "muted"}
								variant={playSource === "raw" ? "solid" : "outline"}
								onPress={() => setPlaySource("raw")}
							>
								View raw
							</Button>
						</View>
						<View className="flex-1">
							<Button
								tone={playSource === "compressed" ? "primary" : "muted"}
								variant={playSource === "compressed" ? "solid" : "outline"}
								onPress={() => setPlaySource("compressed")}
								disabled={!compressed}
							>
								View compressed
							</Button>
						</View>
					</View>

					<Button
						onPress={uploadCurrent}
						loading={upload.isPending}
						disabled={compressing}
					>
						Upload {playSource} to S3
					</Button>
					{uploadMsg ? (
						<Text className="text-muted-foreground text-sm" selectable>
							{uploadMsg}
						</Text>
					) : null}

					<Button tone="muted" variant="outline" onPress={reset}>
						Record again
					</Button>
				</>
			) : (
				<>
					<View className="gap-2">
						<Text className="text-muted-foreground text-xs uppercase">
							Profile (quality + record-time bitrate cap)
						</Text>
						<View className="flex-row gap-2">
							{(Object.keys(EXPO_PRESETS) as PresetKey[]).map((key) => (
								<View key={key} className="flex-1">
									<Button
										tone={preset === key ? "primary" : "muted"}
										variant={preset === key ? "solid" : "outline"}
										onPress={() => setPreset(key)}
										disabled={isRecording}
									>
										{EXPO_PRESETS[key].label}
									</Button>
								</View>
							))}
						</View>
						<Text className="text-muted-foreground text-xs">
							{EXPO_PRESETS[preset].sub} — videoBitrate is a soft cap (holds at
							480p, floored ~5 Mbps at 720p)
						</Text>
					</View>

					{/* Long recording — raises the clip cap for multi-minute test recordings */}
					<Pressable
						className="flex-row items-center justify-between rounded-md border border-border p-3"
						onPress={() => setLongRecording((v) => !v)}
						disabled={isRecording}
					>
						<View className="flex-1 pr-2">
							<Text className="text-foreground text-sm">
								Long recording (5 min)
							</Text>
							<Text className="text-muted-foreground text-xs">
								Raises the max clip from 30s to 5 min
							</Text>
						</View>
						<View
							className={`size-6 items-center justify-center rounded-md border ${longRecording ? "border-primary bg-primary" : "border-border"}`}
						>
							{longRecording ? (
								<Text className="text-primary-foreground text-xs">✓</Text>
							) : null}
						</View>
					</Pressable>

					<View className="flex-row gap-2">
						<View className="flex-1">
							<Button
								tone={isRecording ? "destructive" : "primary"}
								onPress={isRecording ? stopRecording : startRecording}
							>
								{isRecording ? "Stop" : "Record"}
							</Button>
						</View>
						<Pressable
							className="items-center justify-center rounded-md border border-border px-4"
							onPress={() =>
								setFacing((f) => (f === "back" ? "front" : "back"))
							}
							disabled={isRecording}
						>
							<Text className="text-foreground text-sm">Flip</Text>
						</Pressable>
					</View>

					<Text className="text-muted-foreground text-xs">
						Max {longRecording ? LONG_DURATION_SEC : SHORT_DURATION_SEC}s per
						clip. Recording stops automatically at the limit.
					</Text>
				</>
			)}
		</ScrollView>
	);
}

function ResultRow({ label, value }: { label: string; value: string }) {
	return (
		<View className="flex-row justify-between py-1">
			<Text className="text-muted-foreground text-sm">{label}</Text>
			<Text
				className="text-foreground text-sm"
				selectable
				style={{ fontVariant: ["tabular-nums"] }}
			>
				{value}
			</Text>
		</View>
	);
}
