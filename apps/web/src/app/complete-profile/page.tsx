"use client";

import { useUser } from "@clerk/nextjs";
import type { UserRole } from "@genesis/shared";
import { Button } from "@genesis/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@genesis/ui/components/card";
import { Input } from "@genesis/ui/components/input";
import { Label } from "@genesis/ui/components/label";
import { Spinner } from "@genesis/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";
import { useCompleteProfile } from "../../api/auth.api";

const CompleteProfileSchema = z.object({
	name: z.string().min(1, "Please enter your name"),
	role: z.enum(["admin", "member"]),
});

export default function CompleteProfilePage() {
	const { user, isLoaded } = useUser();
	const router = useRouter();

	const completeProfileMutation = useCompleteProfile({
		onSuccess: () => {
			router.push("/portal");
		},
	});

	const form = useForm({
		defaultValues: {
			name: "",
			role: "member" as UserRole,
		},
		validators: {
			onChange: CompleteProfileSchema,
		},
		onSubmit: ({ value }) => {
			completeProfileMutation.mutate({ name: value.name, role: value.role });
		},
	});

	useEffect(() => {
		if (isLoaded && user) {
			form.setFieldValue("name", user.fullName ?? "");
		}
	}, [isLoaded, user, form.setFieldValue]);

	if (!isLoaded) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<Spinner className="size-8" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">Complete Your Profile</CardTitle>
					<CardDescription>
						Just a few more details to get started
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
						className="space-y-4"
					>
						<form.Field
							name="name"
							children={(field) => (
								<div className="space-y-2">
									<Label htmlFor="name">Full Name</Label>
									<Input
										id="name"
										type="text"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={
											field.state.meta.isTouched &&
											field.state.meta.errors.length > 0
										}
									/>
									{field.state.meta.isTouched &&
										field.state.meta.errors.length > 0 && (
											<p className="invalid-input">
												{field.state.meta.errors[0]?.message}
											</p>
										)}
								</div>
							)}
						/>

						<form.Field
							name="role"
							children={(field) => (
								<div className="space-y-2">
									<Label>Role</Label>
									<div className="flex gap-3">
										<Button
											type="button"
											tone="secondary"
											variant={
												field.state.value !== "member" ? "solid" : "outline"
											}
											className="flex-1"
											onClick={() => field.handleChange("member")}
										>
											Member
										</Button>
										<Button
											type="button"
											tone="secondary"
											variant={
												field.state.value !== "admin" ? "solid" : "outline"
											}
											className="flex-1"
											onClick={() => field.handleChange("admin")}
										>
											Admin
										</Button>
									</div>
								</div>
							)}
						/>

						<Button
							type="submit"
							className="w-full"
							disabled={completeProfileMutation.isPending}
						>
							{completeProfileMutation.isPending && (
								<Spinner className="mr-2 size-4" />
							)}
							{completeProfileMutation.isPending ? "Saving..." : "Continue"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
