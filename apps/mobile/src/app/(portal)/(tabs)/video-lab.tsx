import {
	type CameraType,
	CameraView,
	useCameraPermissions,
	useMicrophonePermissions,
	type VideoQuality,
} from "expo-camera";
import { File as FsFile } from "expo-file-system";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Video } from "react-native-compressor";
import { useUploadFile } from "../../../api/storage.api";
import { Button, Card } from "../../../components/ui";
import { Pressable, ScrollView, Text, View } from "../../../tw";

/**
 * Expo-vs-bare video experiment harness.
 *
 * Phase A — record with `expo-camera` and measure raw output (size / bitrate). Proves how
 * much recording control Expo gives natively.
 * Phase B — two ways to get the file under the upload ceiling, both inside Expo (dev client,
 * not bare RN):
 *   Lever A: cap bitrate at RECORD time via the `expo-camera` `videoBitrate` prop (no extra
 *            processing, no third-party module).
 *   Lever B: re-encode AFTER recording with `react-native-compressor` (auto = WhatsApp-style,
 *            or manual to a target bitrate).
 * Then upload the result through the same oRPC path the web app uses, to exercise the full
 * record -> compress -> upload loop against the real 10 MB server limit.
 */

const SHORT_DURATION_SEC = 30;
const LONG_DURATION_SEC = 300; // 5 minutes — for long test recordings.
const BITRATE_CAP = 2_000_000; // 2 Mbps — record-time cap and manual-compress target.

// 480p is Android-only in expo-camera; we test on Android so it's included.
const QUALITIES: VideoQuality[] = ["1080p", "720p", "480p"];

type RecordingResult = {
	uri: string;
	sizeBytes: number;
	durationSec: number;
	quality: VideoQuality;
	bitrateCapped: boolean;
};

type CompressMethod = "auto" | "manual";

type CompressResult = {
	uri: string;
	sizeBytes: number;
	method: CompressMethod;
	elapsedSec: number;
	originalBytes: number;
};

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function effectiveMbps(bytes: number, seconds: number): string {
	if (seconds <= 0) return "—";
	return `${((bytes * 8) / seconds / 1_000_000).toFixed(2)} Mbps`;
}

export default function VideoLab() {
	const [cameraPermission, requestCamera] = useCameraPermissions();
	const [micPermission, requestMic] = useMicrophonePermissions();
	const cameraRef = useRef<CameraView>(null);
	const upload = useUploadFile();

	const [facing, setFacing] = useState<CameraType>("back");
	const [quality, setQuality] = useState<VideoQuality>("720p");
	const [capBitrate, setCapBitrate] = useState(false);
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

	// Live elapsed counter while recording.
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
					quality,
					bitrateCapped: capBitrate,
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
			const response = await fetch(target.uri);
			const blob = await response.blob();
			const name = `lab-clip-${Date.now()}.mp4`;
			const type = blob.type || "video/mp4";
			const file =
				typeof File !== "undefined"
					? new File([blob], name, { type })
					: (Object.assign(blob, { name }) as unknown as File);
			await upload.mutateAsync({ file });
			setUploadMsg(`Uploaded ${formatSize(target.sizeBytes)} to S3.`);
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
						videoQuality={quality}
						videoBitrate={capBitrate ? BITRATE_CAP : undefined}
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
							Raw recording
						</Text>
						<ResultRow
							label="Quality"
							value={`${result.quality}${result.bitrateCapped ? " (capped 2 Mbps)" : ""}`}
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
							Quality
						</Text>
						<View className="flex-row gap-2">
							{QUALITIES.map((q) => (
								<View key={q} className="flex-1">
									<Button
										tone={quality === q ? "primary" : "muted"}
										variant={quality === q ? "solid" : "outline"}
										onPress={() => setQuality(q)}
										disabled={isRecording}
									>
										{q}
									</Button>
								</View>
							))}
						</View>
					</View>

					{/* Phase B — Lever A: cap bitrate at record time */}
					<Pressable
						className="flex-row items-center justify-between rounded-md border border-border p-3"
						onPress={() => setCapBitrate((c) => !c)}
						disabled={isRecording}
					>
						<View className="flex-1 pr-2">
							<Text className="text-foreground text-sm">
								Cap bitrate at record (2 Mbps)
							</Text>
							<Text className="text-muted-foreground text-xs">
								expo-camera videoBitrate — no compression pass
							</Text>
						</View>
						<View
							className={`size-6 items-center justify-center rounded-md border ${capBitrate ? "border-primary bg-primary" : "border-border"}`}
						>
							{capBitrate ? (
								<Text className="text-primary-foreground text-xs">✓</Text>
							) : null}
						</View>
					</Pressable>

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
