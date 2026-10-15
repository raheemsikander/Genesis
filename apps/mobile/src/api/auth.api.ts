import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../utils/orpc";

export function useCompleteProfile({ onSuccess }: { onSuccess: () => void }) {
	const queryClient = useQueryClient();
	return useMutation(
		orpc.auth.completeProfile.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.user.me.queryOptions().queryKey,
				});
				onSuccess();
			},
		}),
	);
}
