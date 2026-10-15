import { useMutation } from "@tanstack/react-query";
import { orpc } from "../utils/orpc";

export function useInviteEmail({
	onSuccess,
}: {
	onSuccess: (data: { id: string }) => void;
}) {
	return useMutation(orpc.email.invite.mutationOptions({ onSuccess }));
}
