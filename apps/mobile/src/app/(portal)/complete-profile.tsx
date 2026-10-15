import { Roles, type UserRole, UserRoleEnum } from "@repo/shared";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "expo-router";
import { z } from "zod";
import { useCompleteProfile } from "../../api/auth.api";
import { Button, Input, Label } from "../../components/ui";
import { SafeAreaView, Text, View } from "../../tw";

const CompleteProfileSchema = z.object({
	name: z.string().min(1, "Please enter your name"),
	role: UserRoleEnum,
});

export default function CompleteProfile() {
	const router = useRouter();
	const mutation = useCompleteProfile({
		onSuccess: () => router.replace("/(portal)/(tabs)"),
	});

	const form = useForm({
		defaultValues: { name: "", role: Roles.MEMBER as UserRole },
		validators: { onChange: CompleteProfileSchema },
		onSubmit: ({ value }) => {
			mutation.mutate({ name: value.name, role: value.role });
		},
	});

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-1 justify-center gap-4 p-6">
				<Text className="font-semibold text-3xl text-foreground">
					Complete your profile
				</Text>
				<form.Field name="name">
					{(field) => (
						<Input
							value={field.state.value}
							onChangeText={field.handleChange}
							onBlur={field.handleBlur}
							placeholder="Full name"
						/>
					)}
				</form.Field>
				<Label>Role</Label>
				<form.Field name="role">
					{(field) => (
						<View className="flex-row gap-3">
							<View className="flex-1">
								<Button
									tone="muted"
									variant={
										field.state.value === Roles.MEMBER ? "solid" : "outline"
									}
									onPress={() => field.handleChange(Roles.MEMBER)}
								>
									Member
								</Button>
							</View>
							<View className="flex-1">
								<Button
									tone="muted"
									variant={
										field.state.value === Roles.ADMIN ? "solid" : "outline"
									}
									onPress={() => field.handleChange(Roles.ADMIN)}
								>
									Admin
								</Button>
							</View>
						</View>
					)}
				</form.Field>
				{mutation.isError ? (
					<Text className="text-destructive text-sm">
						{mutation.error.message}
					</Text>
				) : null}
				<Button
					onPress={() => form.handleSubmit()}
					loading={mutation.isPending}
				>
					Save
				</Button>
			</View>
		</SafeAreaView>
	);
}
