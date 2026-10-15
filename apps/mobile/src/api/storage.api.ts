import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../utils/orpc";

export function useListFiles() {
	return useQuery(orpc.storage.listFiles.queryOptions());
}

export function useUploadFile() {
	const queryClient = useQueryClient();
	return useMutation(
		orpc.storage.uploadFile.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.storage.listFiles.queryOptions().queryKey,
				});
			},
		}),
	);
}

export function useGetFileUrl() {
	return useMutation(orpc.storage.getFileUrl.mutationOptions());
}

export function useDeleteFile() {
	const queryClient = useQueryClient();
	return useMutation(
		orpc.storage.deleteFile.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.storage.listFiles.queryOptions().queryKey,
				});
			},
		}),
	);
}
