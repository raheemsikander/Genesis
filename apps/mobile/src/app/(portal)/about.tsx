import { Card } from "../../components/ui";
import { ScrollView, Text, View } from "../../tw";

const STACK = [
	"React Native + Expo Router",
	"Clerk auth (@clerk/expo)",
	"oRPC + TanStack Query",
	"NativeWind v5 + Tailwind v4",
	"Drizzle ORM (server)",
	"Turborepo + pnpm",
];

export default function About() {
	return (
		<ScrollView className="flex-1 bg-background">
			<View className="gap-4 p-5">
				<Text className="font-semibold text-2xl text-foreground">About</Text>
				<Card>
					{STACK.map((item) => (
						<Text key={item} className="text-base text-foreground">
							• {item}
						</Text>
					))}
				</Card>
			</View>
		</ScrollView>
	);
}
