import { MAX_FILE_SIZE_BYTES } from "@repo/shared";
import * as DocumentPicker from "expo-document-picker";
import * as Linking from "expo-linking";
import { useState } from "react";
import { FlatList, View } from "react-native";
import {
	useDeleteFile,
	useGetFileUrl,
	useListFiles,
	useUploadFile,
} from "../../../../api/storage.api";
import { Button, Card, Spinner, Text } from "../../../../components/ui";
import { toUploadFile } from "../../../../utils/to-upload-file";
import { uriToBlob } from "../../../../utils/uri-to-blob";

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
		 * Read the picked URI into a real Blob: oRPC only uploads File/Blob bytes as
		 * multipart. A plain { uri, name } object serialises as JSON metadata instead, and
		 * the server's file.arrayBuffer() throws. Read via XHR, not fetch (see uriToBlob).
		 */
		try {
			const blob = await uriToBlob(asset.uri);
			if (blob.size > MAX_FILE_SIZE_BYTES) {
				setError(`File too large. Max ${formatSize(MAX_FILE_SIZE_BYTES)}.`);
				return;
			}
			const type = asset.mimeType || blob.type || "application/octet-stream";
			const file = toUploadFile(blob, asset.name, type);
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
		<FlatList
			className="flex-1 bg-background"
			contentInsetAdjustmentBehavior="automatic"
			ListHeaderComponent={
				<View className="gap-2 py-5">
					<Button
						label="Upload file"
						onPress={pickAndUpload}
						loading={upload.isPending}
					/>
					{error ? (
						<Text className="text-destructive text-sm">{error}</Text>
					) : null}
				</View>
			}
			contentContainerClassName="gap-3 px-5 pb-5"
			data={list.data?.files ?? []}
			keyExtractor={(f) => f.uuid}
			ListEmptyComponent={
				<Text className="px-5 text-muted-foreground text-sm">
					No files yet.
				</Text>
			}
			renderItem={({ item }) => (
				<Card className="gap-3 p-5">
					<Text className="font-medium text-base text-foreground">
						{item.fileName}
					</Text>
					<Text className="text-muted-foreground text-sm">
						{formatSize(item.sizeBytes)} · {item.contentType}
					</Text>
					<View className="flex-row gap-2 pt-1">
						<View className="flex-1">
							<Button
								label="View"
								variant="outline"
								onPress={() => open(item.uuid, "view")}
							/>
						</View>
						<View className="flex-1">
							<Button
								label="Download"
								variant="outline"
								onPress={() => open(item.uuid, "download")}
							/>
						</View>
						<View className="flex-1">
							<Button
								label="Delete"
								variant="destructive"
								onPress={() => handleDelete(item.uuid)}
							/>
						</View>
					</View>
				</Card>
			)}
		/>
	);
}
