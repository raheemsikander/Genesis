import { InviteEmailInputSchema } from "@repo/shared";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useInviteEmail } from "../../api/email.api";
import { SafeAreaView } from "../../components/safe-area-view";
import { Button, Card, Input, Label, Text } from "../../components/ui";

export default function Email() {
	const [sentId, setSentId] = useState<string | null>(null);
	const mutation = useInviteEmail({ onSuccess: (data) => setSentId(data.id) });

	const form = useForm({
		defaultValues: { to: "", message: "" } as InviteEmailInputSchema,
		validators: { onChange: InviteEmailInputSchema },
		onSubmit: ({ value }) => {
			setSentId(null);
			mutation.mutate({ to: value.to, message: value.message || undefined });
		},
	});

	return (
		<SafeAreaView className="flex-1 bg-background">
			<ScrollView contentContainerClassName="gap-4 p-5">
				<Text className="font-semibold text-2xl text-foreground">
					Send invite
				</Text>
				<form.Field name="to">
					{(field) => (
						<View className="gap-1">
							<Label>Recipient email</Label>
							<Input
								value={field.state.value}
								onChangeText={field.handleChange}
								onBlur={field.handleBlur}
								placeholder="invitee@example.com"
								keyboardType="email-address"
								autoCapitalize="none"
								className={
									field.state.meta.isTouched &&
									field.state.meta.errors.length > 0
										? "border-destructive"
										: undefined
								}
							/>
							{field.state.meta.isTouched && field.state.meta.errors[0] ? (
								<Text className="text-destructive text-sm">
									{field.state.meta.errors[0]?.message}
								</Text>
							) : null}
						</View>
					)}
				</form.Field>
				<form.Field name="message">
					{(field) => (
						<View className="gap-1">
							<Label>Message (optional)</Label>
							<Input
								value={field.state.value}
								onChangeText={field.handleChange}
								onBlur={field.handleBlur}
								placeholder="Join our team!"
								multiline
								numberOfLines={4}
								className="h-24"
							/>
						</View>
					)}
				</form.Field>
				{mutation.isError ? (
					<Text className="text-destructive text-sm">
						{mutation.error.message}
					</Text>
				) : null}
				<Button
					label="Send invite"
					onPress={() => form.handleSubmit()}
					loading={mutation.isPending}
				/>
				{sentId ? (
					<Card className="gap-3 p-5">
						<Text className="font-medium text-foreground">Invite sent</Text>
						<Text className="text-muted-foreground text-sm">
							Message ID: {sentId}
						</Text>
					</Card>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}
