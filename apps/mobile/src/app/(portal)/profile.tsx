import { useUser } from "@clerk/expo";
import { format } from "date-fns";
import { Image } from "expo-image";
import { ScrollView, View } from "react-native";
import { RoleBadge } from "../../components/role-badge";
import { Button, Card, Spinner, Text } from "../../components/ui";
import { useDbUser } from "../../hooks/use-auth";

export default function Profile() {
	const { user: dbUser, isLoading, isError, refetch } = useDbUser();
	const { user: clerkUser } = useUser();

	if (isLoading) return <Spinner />;
	if (isError || !dbUser) {
		return (
			<View className="flex-1 items-center justify-center gap-3 bg-background p-6">
				<Text className="text-foreground">Could not load profile.</Text>
				<Button label="Retry" onPress={refetch} />
			</View>
		);
	}

	return (
		<ScrollView className="flex-1 bg-background">
			<View className="gap-4 p-5">
				<Card className="items-center gap-3 p-5">
					{dbUser.imageUrl ? (
						<Image
							source={{ uri: dbUser.imageUrl }}
							style={{ width: 80, height: 80, borderRadius: 40 }}
						/>
					) : null}
					<Text className="font-semibold text-foreground text-xl">
						{dbUser.name}
					</Text>
					<Text className="text-muted-foreground text-sm">{dbUser.email}</Text>
					<RoleBadge role={dbUser.role} />
				</Card>
				<Card className="gap-3 p-5">
					<Field label="UUID" value={dbUser.uuid} />
					{clerkUser?.createdAt ? (
						<Field
							label="Joined"
							value={format(new Date(clerkUser.createdAt), "MMM d, yyyy")}
						/>
					) : null}
				</Card>
			</View>
		</ScrollView>
	);
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<View className="gap-1">
			<Text className="text-muted-foreground text-sm">{label}</Text>
			<Text className="text-base text-foreground">{value}</Text>
		</View>
	);
}
