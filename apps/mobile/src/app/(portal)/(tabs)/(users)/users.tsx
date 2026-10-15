import { Image } from "expo-image";
import { FlatList, View } from "react-native";
import { useListUsers } from "../../../../api/user.api";
import { RoleBadge } from "../../../../components/role-badge";
import { Card, Spinner, Text } from "../../../../components/ui";

export default function Users() {
	const query = useListUsers();
	if (query.isPending) return <Spinner />;
	if (query.isError) {
		return (
			<View className="flex-1 items-center justify-center bg-background p-6">
				<Text className="text-foreground">Could not load users.</Text>
			</View>
		);
	}
	return (
		<FlatList
			className="flex-1 bg-background"
			contentInsetAdjustmentBehavior="automatic"
			contentContainerClassName="gap-3 p-5"
			data={query.data.users}
			keyExtractor={(u) => u.uuid}
			renderItem={({ item }) => (
				<Card className="gap-3 p-5">
					<View className="flex-row items-center gap-3">
						{item.imageUrl ? (
							<Image
								source={{ uri: item.imageUrl }}
								style={{ width: 44, height: 44, borderRadius: 22 }}
							/>
						) : null}
						<View className="flex-1 gap-0.5">
							<Text className="font-medium text-base text-foreground">
								{item.name}
							</Text>
							<Text className="text-muted-foreground text-sm">
								{item.email}
							</Text>
						</View>
						<RoleBadge role={item.role} />
					</View>
				</Card>
			)}
		/>
	);
}
