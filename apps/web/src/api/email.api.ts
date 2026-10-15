import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "../utils/orpc";

export function useInviteEmail({
	onSuccess,
}: {
	onSuccess: (data: { id: string }) => void;
}) {
	return useMutation(
		orpc.email.invite.mutationOptions({
			onSuccess: (data) => {
				onSuccess(data);
				toast.success("Invite email sent successfully!");
			},
		}),
	);
}
