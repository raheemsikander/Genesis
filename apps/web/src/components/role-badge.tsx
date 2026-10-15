import { Roles, type UserRole } from "@repo/shared";
import { Badge } from "@repo/ui/components/badge";
import { ShieldIcon, UserIcon } from "lucide-react";

export function RoleBadge({ role }: { role: UserRole }) {
	const isAdmin = role === Roles.ADMIN;
	return (
		<Badge tone={isAdmin ? "primary" : "secondary"} variant="outline">
			{isAdmin ? (
				<ShieldIcon className="h-3 w-3" />
			) : (
				<UserIcon className="h-3 w-3" />
			)}
			<span className="ml-1">{isAdmin ? "Admin" : "Member"}</span>
		</Badge>
	);
}
