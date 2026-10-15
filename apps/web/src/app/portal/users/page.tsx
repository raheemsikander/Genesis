"use client";

import { Roles } from "@repo/shared";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { format } from "date-fns";
import { ShieldIcon, UserIcon, UsersIcon } from "lucide-react";
import { useListUsers } from "../../../api/user.api";
import { BaseLayout } from "../../../components/base-layout";

function RoleBadge({ role }: { role: string }) {
	if (role === Roles.ADMIN) {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary text-xs">
				<ShieldIcon className="h-3 w-3" />
				Admin
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
			<UserIcon className="h-3 w-3" />
			Member
		</span>
	);
}

export default function UsersPage() {
	const { data, isLoading } = useListUsers();

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
						) : !data?.users.length ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<UsersIcon className="mb-3 h-10 w-10 text-muted-foreground" />
								<p className="text-muted-foreground text-sm">No users yet.</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b text-left text-sm">
											<th className="px-4 py-3 font-medium">Name</th>
											<th className="px-4 py-3 font-medium">Email</th>
											<th className="px-4 py-3 font-medium">Role</th>
											<th className="px-4 py-3 font-medium">Joined</th>
										</tr>
									</thead>
									<tbody>
										{data.users.map((user) => (
											<tr key={user.uuid} className="border-b last:border-0">
												<td className="max-w-[200px] truncate px-4 py-3 font-medium text-sm">
													<div className="flex items-center gap-2">
														{user.imageUrl ? (
															<img
																src={user.imageUrl}
																alt=""
																className="h-7 w-7 rounded-full object-cover"
															/>
														) : (
															<div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
																<UserIcon className="h-3.5 w-3.5 text-primary" />
															</div>
														)}
														{user.name || "—"}
													</div>
												</td>
												<td className="px-4 py-3 text-muted-foreground text-sm">
													{user.email}
												</td>
												<td className="px-4 py-3">
													<RoleBadge role={user.role} />
												</td>
												<td className="px-4 py-3 text-muted-foreground text-sm">
													{format(new Date(user.createdAt), "MMM d, yyyy")}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</BaseLayout>
	);
}
