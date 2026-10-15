"use client";

import { useUser } from "@clerk/nextjs";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { format } from "date-fns";
import { CalendarIcon, MailIcon, ShieldIcon, UserIcon } from "lucide-react";
import Image from "next/image";
import { BaseLayout } from "../../../components/base-layout";

export default function ProfilePage() {
	const { user, isLoaded } = useUser();

	if (!isLoaded) {
		return (
			<BaseLayout title="Profile" description="Your account information.">
				<div className="flex items-center justify-center py-12">
					<div className="spinner" />
				</div>
			</BaseLayout>
		);
	}

	if (!user) {
		return (
			<BaseLayout title="Profile" description="Your account information.">
				<p className="text-muted-foreground text-sm">
					Sign in to view your profile.
				</p>
			</BaseLayout>
		);
	}

	const createdAt = user.createdAt
		? format(new Date(user.createdAt), "MMMM d, yyyy")
		: null;

	return (
		<BaseLayout
			title="Profile"
			description="Manage your account and personal information."
		>
			<div className="space-y-6">
				<Card>
					<CardContent className="p-6">
						<div className="flex items-center gap-5">
							{user.imageUrl ? (
								<Image
									src={user.imageUrl}
									width={64}
									height={64}
									alt={user.fullName ?? "Profile"}
									className="h-16 w-16 rounded-full object-cover ring-2 ring-ring ring-offset-2 ring-offset-background"
								/>
							) : (
								<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 ring-2 ring-ring ring-offset-2 ring-offset-background">
									<UserIcon className="h-8 w-8 text-primary" />
								</div>
							)}
							<div>
								<h2 className="mp-mask font-semibold text-foreground text-xl">
									{user.fullName ?? "No name set"}
								</h2>
								<p className="mp-mask text-muted-foreground text-sm">
									{user.primaryEmailAddress?.emailAddress}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center gap-2 text-sm">
								<UserIcon className="h-4 w-4 text-primary" />
								Name
							</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription className="mp-mask text-foreground">
								{user.firstName && user.lastName
									? `${user.firstName} ${user.lastName}`
									: (user.fullName ?? "—")}
							</CardDescription>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center gap-2 text-sm">
								<MailIcon className="h-4 w-4 text-primary" />
								Email
							</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription className="mp-mask text-foreground">
								{user.primaryEmailAddress?.emailAddress ?? "—"}
							</CardDescription>
						</CardContent>
					</Card>

					{createdAt && (
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="flex items-center gap-2 text-sm">
									<CalendarIcon className="h-4 w-4 text-primary" />
									Member Since
								</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription className="text-foreground">
									{createdAt}
								</CardDescription>
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center gap-2 text-sm">
								<ShieldIcon className="h-4 w-4 text-primary" />
								User ID
							</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription className="truncate font-mono text-xs">
								{user.id}
							</CardDescription>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Authentication</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						{[
							"Your profile is managed by Clerk and persisted securely.",
							"Session tokens are automatically refreshed in the background.",
							"Sign out from any device through the Clerk dashboard.",
						].map((note) => (
							<div key={note} className="flex items-start gap-2.5">
								<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ring" />
								<p className="text-muted-foreground text-sm">{note}</p>
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</BaseLayout>
	);
}
