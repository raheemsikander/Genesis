"use client";

import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { format } from "date-fns";
import { UserIcon, UsersIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useListUsers } from "../../../api/user.api";
import { BaseLayout } from "../../../components/base-layout";
import { RoleBadge } from "../../../components/role-badge";

export default function UsersPage() {
	const { data, isLoading, isError } = useListUsers();

	return (
		<BaseLayout title="Users" description="View all team members.">
			<div className="space-y-6 p-6">
				<h2 className="font-semibold text-lg">Team Members</h2>

				<Card>
					<CardContent className="p-0">
						{isLoading ? (
							<div className="space-y-3 p-6">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
						) : isError ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<UsersIcon className="mb-3 h-10 w-10 text-muted-foreground" />
								<p className="text-foreground text-sm">Couldn't load users</p>
								<p className="mt-1 text-muted-foreground text-xs">
									Something went wrong fetching the user list. Please try again.
								</p>
							</div>
						) : !data?.users.length ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<UsersIcon className="mb-3 h-10 w-10 text-muted-foreground" />
								<p className="text-muted-foreground text-sm">No users yet.</p>
							</div>
						) : (
							<ul className="divide-y">
								{data.users.map((user) => (
									<li key={user.uuid}>
										<Link
											href={`/portal/users/${user.uuid}`}
											aria-label={`View ${user.name || user.email}`}
											className="flex w-full items-center transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<div className="flex max-w-[200px] flex-1 items-center gap-2 truncate px-4 py-3 font-medium text-sm">
												{user.imageUrl ? (
													<Image
														src={user.imageUrl}
														alt=""
														width={28}
														height={28}
														className="h-7 w-7 rounded-full object-cover"
													/>
												) : (
													<div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
														<UserIcon className="h-3.5 w-3.5 text-primary" />
													</div>
												)}
												{user.name || "—"}
											</div>
											<div className="flex-1 px-4 py-3 text-muted-foreground text-sm">
												{user.email}
											</div>
											<div className="flex-1 px-4 py-3">
												<RoleBadge role={user.role} />
											</div>
											<div className="flex-1 px-4 py-3 text-muted-foreground text-sm">
												{format(new Date(user.createdAt), "MMM d, yyyy")}
											</div>
										</Link>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			</div>
		</BaseLayout>
	);
}
