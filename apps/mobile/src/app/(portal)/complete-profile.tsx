import { Roles, type UserRole, UserRoleEnum } from "@repo/shared";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { z } from "zod";
import { useCompleteProfile } from "../../api/auth.api";
import { SafeAreaView } from "../../components/safe-area-view";
import { Button, Input, Label, Text } from "../../components/ui";

const CompleteProfileSchema = z.object({
	name: z.string().min(1, "Please enter your name"),
	role: UserRoleEnum,
});

export default function CompleteProfile() {
	const router = useRouter();
	const mutation = useCompleteProfile({
		onSuccess: () => router.replace("/(portal)/(tabs)/(home)"),
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
									label="Member"
									variant={
										field.state.value === Roles.MEMBER ? "default" : "outline"
									}
									onPress={() => field.handleChange(Roles.MEMBER)}
								/>
							</View>
							<View className="flex-1">
								<Button
									label="Admin"
									variant={
										field.state.value === Roles.ADMIN ? "default" : "outline"
									}
									onPress={() => field.handleChange(Roles.ADMIN)}
								/>
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
					label="Save"
					onPress={() => form.handleSubmit()}
					loading={mutation.isPending}
				/>
			</View>
		</SafeAreaView>
	);
}
