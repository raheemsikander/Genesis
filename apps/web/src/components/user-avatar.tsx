"use client";

import type { useUser } from "@clerk/nextjs";
import { cn } from "@repo/ui/lib/utils";
import { UserIcon } from "lucide-react";
import Image from "next/image";

export function UserAvatar({
	user,
	size = "md",
}: {
	user: ReturnType<typeof useUser>["user"];
	size?: "sm" | "md";
}) {
	const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
	const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
	if (user?.imageUrl) {
		return (
			<Image
				src={user.imageUrl}
				alt={user.fullName ?? "User"}
				width={size === "sm" ? 28 : 32}
				height={size === "sm" ? 28 : 32}
				className={cn(dim, "rounded-full object-cover")}
			/>
		);
	}
	return (
		<div
			className={cn(
				dim,
				"flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary",
			)}
		>
			<UserIcon className={icon} />
		</div>
	);
}
