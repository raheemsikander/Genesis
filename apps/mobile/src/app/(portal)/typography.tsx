import { ScrollView, View } from "react-native";
import { Text } from "../../components/ui";

export default function Typography() {
	return (
		<ScrollView className="flex-1 bg-background">
			<View className="gap-3 p-5">
				<Text className="font-semibold text-2xl text-foreground">
					Typography
				</Text>
				<Text className="font-semibold text-5xl text-foreground">
					Heading XL
				</Text>
				<Text className="font-semibold text-3xl text-foreground">
					Heading L
				</Text>
				<Text className="font-medium text-foreground text-xl">Heading M</Text>
				<Text className="text-base text-foreground">
					Body — the quick brown fox jumps over the lazy dog.
				</Text>
				<Text className="text-muted-foreground text-sm">
					Caption / muted text.
				</Text>
			</View>
		</ScrollView>
	);
}
