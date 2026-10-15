import { Roles, type UserRole } from "@repo/shared";
import { Badge, Text } from "./ui";

export function RoleBadge({ role }: { role: UserRole }) {
	return (
		<Badge>
			<Text>{role === Roles.ADMIN ? "Admin" : "Member"}</Text>
		</Badge>
	);
}
