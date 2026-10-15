"use client";

import { InviteEmailInputSchema } from "@repo/shared";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { CheckCircleIcon, MailIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { useInviteEmail } from "../../../api/email.api";
import { BaseLayout } from "../../../components/base-layout";

export default function EmailPage() {
	const [lastSentId, setLastSentId] = useState<string | null>(null);

	const invite = useInviteEmail({
		onSuccess: (data) => {
			setLastSentId(data.id);
			form.reset();
		},
	});

	const form = useForm({
		defaultValues: {
			to: "",
			message: "",
		} as InviteEmailInputSchema,
		validators: {
			onChange: InviteEmailInputSchema,
		},
		onSubmit: ({ value }) => {
			setLastSentId(null);
			invite.mutate({ to: value.to, message: value.message || undefined });
		},
	});

	return (
		<BaseLayout
			title="Email"
			description="Send invite emails using Resend and React Email templates."
		>
			<div className="mx-auto max-w-lg space-y-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<MailIcon className="h-5 w-5 text-primary" />
							Send Invite
						</CardTitle>
						<CardDescription>
							Invite someone to join Project Genesis. The email is rendered
							server-side using React Email and delivered via Resend.
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
								name="to"
								children={(field) => (
									<div className="space-y-2">
										<Label htmlFor="to">Recipient Email</Label>
										<Input
											id="to"
											type="email"
											placeholder="colleague@example.com"
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
												<p className="text-destructive-foreground text-xs">
													{field.state.meta.errors[0]?.message}
												</p>
											)}
									</div>
								)}
							/>

							<form.Field
								name="message"
								children={(field) => (
									<div className="space-y-2">
										<Label htmlFor="message">
											Message{" "}
											<span className="text-muted-foreground">(optional)</span>
										</Label>
										<Textarea
											id="message"
											placeholder="Hey, check out Project Genesis!"
											value={field.state.value ?? ""}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											maxLength={500}
											rows={3}
											aria-invalid={
												field.state.meta.isTouched &&
												field.state.meta.errors.length > 0
											}
										/>
										{(field.state.value?.length ?? 0) > 0 && (
											<p className="text-right text-muted-foreground text-xs">
												{field.state.value?.length ?? 0}/500
											</p>
										)}
										{field.state.meta.isTouched &&
											field.state.meta.errors.length > 0 && (
												<p className="text-destructive-foreground text-xs">
													{field.state.meta.errors[0]?.message}
												</p>
											)}
									</div>
								)}
							/>

							<Button
								type="submit"
								disabled={invite.isPending || !form.state.canSubmit}
								className="w-full"
							>
								{invite.isPending ? (
									<>
										<div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
										Sending...
									</>
								) : (
									<>
										<SendIcon className="mr-2 h-4 w-4" />
										Send Invite
									</>
								)}
							</Button>
						</form>
					</CardContent>
				</Card>

				{lastSentId && (
					<Card className="border-success-foreground/20 bg-success">
						<CardContent className="flex items-center gap-3 p-4">
							<CheckCircleIcon className="h-5 w-5 shrink-0 text-success-foreground" />
							<div>
								<p className="font-medium text-sm text-success-foreground">
									Email sent successfully
								</p>
								<p className="font-mono text-success-foreground/80 text-xs">
									ID: {lastSentId}
								</p>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</BaseLayout>
	);
}
