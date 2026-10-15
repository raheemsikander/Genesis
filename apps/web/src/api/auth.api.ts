import { useMutation } from "@tanstack/react-query";
import { orpc } from "../utils/orpc";

export function useCompleteProfile({ onSuccess }: { onSuccess: () => void }) {
	return useMutation(
		orpc.auth.completeProfile.mutationOptions({
			onSuccess: () => {
				onSuccess();
			},
		}),
	);
}
