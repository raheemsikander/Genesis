import { MAX_FILE_SIZE_BYTES } from "@repo/shared";
import * as DocumentPicker from "expo-document-picker";
import * as Linking from "expo-linking";
import { useState } from "react";
import {
	useDeleteFile,
	useGetFileUrl,
	useListFiles,
	useUploadFile,
} from "../../../api/storage.api";
import { Button, Card, Spinner } from "../../../components/ui";
import { FlatList, Text, View } from "../../../tw";

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Storage() {
	const list = useListFiles();
	const upload = useUploadFile();
	const getUrl = useGetFileUrl();
	const remove = useDeleteFile();
	const [error, setError] = useState<string | null>(null);

	async function pickAndUpload() {
		setError(null);
		const result = await DocumentPicker.getDocumentAsync({
			copyToCacheDirectory: true,
		});
		if (result.canceled) return;
		const asset = result.assets[0];
		if (!asset) return;
		if (asset.size && asset.size > MAX_FILE_SIZE_BYTES) {
			setError(`File too large. Max ${formatSize(MAX_FILE_SIZE_BYTES)}.`);
			return;
		}
		/**
		 * Fetch the picked URI into a real Blob: oRPC only uploads File/Blob bytes as
		 * multipart. A plain { uri, name } object serialises as JSON metadata instead, and
		 * the server's file.arrayBuffer() throws.
		 */
		try {
			const response = await fetch(asset.uri);
			const blob = await response.blob();
			const type = asset.mimeType ?? blob.type ?? "application/octet-stream";
			const file =
				typeof File !== "undefined"
					? new File([blob], asset.name, { type })
					: (Object.assign(blob, { name: asset.name }) as unknown as File);
			await upload.mutateAsync({ file });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Upload failed");
		}
	}

	async function open(uuid: string, mode: "view" | "download") {
		setError(null);
		try {
			const { url } = await getUrl.mutateAsync({ uuid, mode });
			await Linking.openURL(url);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not open file");
		}
	}

	function handleDelete(uuid: string) {
		setError(null);
		remove.mutate(
			{ uuid },
			{
				onError: (e) =>
					setError(e instanceof Error ? e.message : "Delete failed"),
			},
		);
	}

	if (list.isPending) return <Spinner />;

	if (list.isError) {
		return (
			<View className="flex-1 items-center justify-center bg-background p-6">
				<Text className="text-foreground">Could not load files.</Text>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<View className="gap-2 p-5">
				<Button onPress={pickAndUpload} loading={upload.isPending}>
					Upload file
				</Button>
				{error ? (
					<Text className="text-destructive text-sm">{error}</Text>
				) : null}
			</View>
			<FlatList
				contentContainerClassName="gap-3 px-5 pb-5"
				data={list.data?.files ?? []}
				keyExtractor={(f) => f.uuid}
				ListEmptyComponent={
					<Text className="px-5 text-muted-foreground text-sm">
						No files yet.
					</Text>
				}
				renderItem={({ item }) => (
					<Card>
						<Text className="font-medium text-base text-foreground">
							{item.fileName}
						</Text>
						<Text className="text-muted-foreground text-sm">
							{formatSize(item.sizeBytes)} · {item.contentType}
						</Text>
						<View className="flex-row gap-2 pt-1">
							<View className="flex-1">
								<Button
									tone="muted"
									variant="outline"
									onPress={() => open(item.uuid, "view")}
								>
									View
								</Button>
							</View>
							<View className="flex-1">
								<Button
									tone="muted"
									variant="outline"
									onPress={() => open(item.uuid, "download")}
								>
									Download
								</Button>
							</View>
							<View className="flex-1">
								<Button
									tone="destructive"
									variant="outline"
									onPress={() => handleDelete(item.uuid)}
								>
									Delete
								</Button>
							</View>
						</View>
					</Card>
				)}
			/>
		</View>
	);
}
