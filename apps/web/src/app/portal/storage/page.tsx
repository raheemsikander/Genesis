"use client";

import { MAX_FILE_SIZE_BYTES } from "@repo/shared";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { format } from "date-fns";
import {
	DownloadIcon,
	ExternalLinkIcon,
	FileIcon,
	TrashIcon,
	UploadIcon,
} from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import {
	useDeleteFile,
	useGetFileUrl,
	useListFiles,
	useUploadFile,
} from "../../../api/storage.api";
import { BaseLayout } from "../../../components/base-layout";

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StoragePage() {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { data, isLoading } = useListFiles();
	const uploadFile = useUploadFile();
	const getFileUrl = useGetFileUrl();
	const deleteFile = useDeleteFile();

	async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.size > MAX_FILE_SIZE_BYTES) {
			toast.error(
				`File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`,
			);
			return;
		}

		try {
			await uploadFile.mutateAsync({ file });
		} finally {
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	}

	async function handleView(uuid: string) {
		const { url } = await getFileUrl.mutateAsync({ uuid, mode: "view" });
		window.open(url, "_blank");
	}

	async function handleDownload(uuid: string) {
		const { url } = await getFileUrl.mutateAsync({
			uuid,
			mode: "download",
		});
		window.location.href = url;
	}

	return (
		<BaseLayout
			title="File Storage"
			description="Upload, download, and manage your files."
		>
			<div className="space-y-6 p-6">
				{/* Upload Section */}
				<div className="flex items-center justify-between">
					<h2 className="font-semibold text-lg">Your Files</h2>
					<div>
						<input
							ref={fileInputRef}
							type="file"
							onChange={handleFileSelect}
							className="hidden"
						/>
						<Button
							onClick={() => fileInputRef.current?.click()}
							disabled={uploadFile.isPending}
						>
							<UploadIcon className="mr-2 h-4 w-4" />
							{uploadFile.isPending ? "Uploading..." : "Upload File"}
						</Button>
					</div>
				</div>

				{/* Files Table */}
				<Card>
					<CardContent className="p-0">
						{isLoading ? (
							<div className="space-y-3 p-6">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
						) : !data?.files.length ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<FileIcon className="mb-3 h-10 w-10 text-muted-foreground" />
								<p className="text-muted-foreground text-sm">
									No files uploaded yet. Click &quot;Upload File&quot; to get
									started.
								</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b text-left text-sm">
											<th className="px-4 py-3 font-medium">Name</th>
											<th className="px-4 py-3 font-medium">Type</th>
											<th className="px-4 py-3 font-medium">Size</th>
											<th className="px-4 py-3 font-medium">Uploaded</th>
											<th className="px-4 py-3 text-right font-medium">
												Actions
											</th>
										</tr>
									</thead>
									<tbody>
										{data.files.map((file) => (
											<tr key={file.uuid} className="border-b last:border-0">
												<td className="max-w-[200px] truncate px-4 py-3 font-medium text-sm">
													{file.fileName}
												</td>
												<td className="px-4 py-3 text-muted-foreground text-sm">
													{file.contentType}
												</td>
												<td className="px-4 py-3 text-muted-foreground text-sm">
													{formatFileSize(file.sizeBytes)}
												</td>
												<td className="px-4 py-3 text-muted-foreground text-sm">
													{format(new Date(file.createdAt), "MMM d, yyyy")}
												</td>
												<td className="px-4 py-3 text-right">
													<div className="flex justify-end gap-1">
														<Button
															variant="ghost"
															size="sm"
															onClick={() => handleView(file.uuid)}
															disabled={getFileUrl.isPending}
															title="Open in new tab"
														>
															<ExternalLinkIcon className="h-4 w-4" />
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => handleDownload(file.uuid)}
															disabled={getFileUrl.isPending}
															title="Download"
														>
															<DownloadIcon className="h-4 w-4" />
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onClick={() =>
																deleteFile.mutate({
																	uuid: file.uuid,
																})
															}
															disabled={deleteFile.isPending}
															title="Delete"
														>
															<TrashIcon className="h-4 w-4" />
														</Button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</BaseLayout>
	);
}
