import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "../utils/orpc";

export function useUploadFile() {
	const queryClient = useQueryClient();

	return useMutation(
		orpc.storage.uploadFile.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.storage.listFiles.queryOptions().queryKey,
				});
				toast.success("File uploaded successfully!");
			},
		}),
	);
}

export function useGetFileUrl() {
	return useMutation(orpc.storage.getFileUrl.mutationOptions());
}

export function useListFiles() {
	return useQuery(orpc.storage.listFiles.queryOptions());
}

export function useDeleteFile() {
	const queryClient = useQueryClient();
	return useMutation(
		orpc.storage.deleteFile.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.storage.listFiles.queryOptions().queryKey,
				});
				toast.success("File deleted");
			},
		}),
	);
}
