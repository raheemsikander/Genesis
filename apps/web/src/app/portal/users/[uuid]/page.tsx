"use client";

import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { format } from "date-fns";
import { UserIcon } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useListUsers } from "../../../../api/user.api";
import { BaseLayout } from "../../../../components/base-layout";
import { RoleBadge } from "../../../../components/role-badge";
import { useSetBreadcrumbLabel } from "../../../../providers/breadcrumb-provider";

export default function UserDetailPage() {
	const params = useParams<{ uuid: string }>();
	const uuid = params.uuid;
	// Demo of the breadcrumb dynamic-label pattern: reads the user from the
	// cached list rather than via a dedicated lookup. This is fine for the
	// showcase route but is NOT a production lookup — a deep link (refresh,
	// paste, new tab) only finds the user if they happen to be on the loaded
	// page, and that will break once /portal/users paginates. Real feature
	// routes should add a `users.byUuid` (or equivalent) oRPC procedure.
	const { data, isLoading, isError } = useListUsers();

	const user = data?.users.find((u) => u.uuid === uuid);

	useSetBreadcrumbLabel(user?.name);

	if (isLoading) {
		return (
			<BaseLayout title="User Details">
				<div className="space-y-3 p-6">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-72" />
					<Skeleton className="h-4 w-64" />
				</div>
			</BaseLayout>
		);
	}

	if (isError) {
		return (
			<BaseLayout title="User Details">
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12 text-center">
						<UserIcon className="mb-3 h-10 w-10 text-muted-foreground" />
						<p className="text-foreground text-sm">Couldn't load user</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Something went wrong fetching the user list. Please try again.
						</p>
					</CardContent>
				</Card>
			</BaseLayout>
		);
	}

	if (!user) {
		return (
			<BaseLayout title="User Details">
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12 text-center">
						<UserIcon className="mb-3 h-10 w-10 text-muted-foreground" />
						<p className="text-foreground text-sm">User not found</p>
						<p className="mt-1 text-muted-foreground text-xs">
							The user you're looking for doesn't exist or has been removed.
						</p>
					</CardContent>
				</Card>
			</BaseLayout>
		);
	}

	return (
		<BaseLayout title={user.name || user.email}>
			<div className="space-y-6 p-6">
				<Card>
					<CardContent className="flex items-center gap-4 py-6">
						{user.imageUrl ? (
							<Image
								src={user.imageUrl}
								alt={user.name || user.email}
								width={64}
								height={64}
								className="h-16 w-16 rounded-full object-cover"
							/>
						) : (
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
								<UserIcon className="h-7 w-7 text-primary" />
							</div>
						)}
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">{user.email}</p>
							<div className="pt-1">
								<RoleBadge role={user.role} />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="py-6">
						<dl className="space-y-2 text-sm">
							<div className="flex justify-between">
								<dt className="text-muted-foreground">Joined</dt>
								<dd>{format(new Date(user.createdAt), "MMMM d, yyyy")}</dd>
							</div>
							<div className="flex justify-between">
								<dt className="text-muted-foreground">ID</dt>
								<dd className="font-mono text-xs">{user.uuid}</dd>
							</div>
						</dl>
					</CardContent>
				</Card>
			</div>
		</BaseLayout>
	);
}
