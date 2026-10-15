import { Roles, type UserRole } from "@repo/shared";
import { Badge } from "./ui";

export function RoleBadge({ role }: { role: UserRole }) {
	return <Badge>{role === Roles.ADMIN ? "Admin" : "Member"}</Badge>;
}
