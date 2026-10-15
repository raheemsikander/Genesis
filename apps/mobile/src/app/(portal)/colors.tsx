import { ScrollView, View } from "react-native";
import { Text } from "../../components/ui";

const TOKENS = [
	{ name: "background", bg: "bg-background" },
	{ name: "foreground", bg: "bg-foreground" },
	{ name: "card", bg: "bg-card" },
	{ name: "primary", bg: "bg-primary" },
	{ name: "muted", bg: "bg-muted" },
	{ name: "border", bg: "bg-border" },
	{ name: "destructive", bg: "bg-destructive" },
];

export default function Colors() {
	return (
		<ScrollView className="flex-1 bg-background">
			<View className="gap-3 p-5">
				<Text className="font-semibold text-2xl text-foreground">Colors</Text>
				{TOKENS.map((t) => (
					<View key={t.name} className="flex-row items-center gap-3">
						<View
							className={`h-12 w-12 rounded-lg border border-border ${t.bg}`}
						/>
						<Text className="text-base text-foreground">{t.name}</Text>
					</View>
				))}
			</View>
		</ScrollView>
	);
}
