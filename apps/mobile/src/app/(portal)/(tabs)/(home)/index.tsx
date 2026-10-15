import { useUser } from "@clerk/expo";
import { ScrollView, View } from "react-native";
import { Card, Text } from "../../../../components/ui";

export default function Home() {
	const { user } = useUser();
	return (
		<ScrollView
			className="flex-1 bg-background"
			contentInsetAdjustmentBehavior="automatic"
		>
			<View className="gap-4 p-5">
				<Text className="font-semibold text-3xl text-foreground">
					Welcome{user?.firstName ? `, ${user.firstName}` : ""}
				</Text>
				<Card className="gap-3 p-5">
					<Text className="font-bold text-base text-foreground">
						Getting started
					</Text>
					<Text className="text-muted-foreground text-sm">
						This is the mobile portal home. Use the tabs below to navigate.
					</Text>
				</Card>
			</View>
		</ScrollView>
	);
}
