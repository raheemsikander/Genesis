import { Linking, Pressable, ScrollView, View } from "react-native";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Text,
} from "../../components/ui";
import { env } from "../../utils/env";

const techStack = [
	{
		name: "React Native & TypeScript",
		description: "Native iOS and Android from one codebase, fully typed",
	},
	{
		name: "Expo (SDK 56)",
		description:
			"Managed native tooling with Expo Router file-based navigation",
	},
	{
		name: "Clerk",
		description: "Authentication with secure on-device token storage",
	},
	{
		name: "oRPC + TanStack Query",
		description:
			"Type-safe API calls sharing the same contracts as the web app",
	},
	{
		name: "react-native-reusables",
		description: "shadcn/ui-style components built on accessible RN primitives",
	},
	{
		name: "Uniwind + Tailwind CSS",
		description:
			"Utility-first styling with design tokens shared with the web app",
	},
	{
		name: "Turborepo",
		description: "Monorepo build system for fast, incremental builds",
	},
	{
		name: "Biome",
		description:
			"Fast, unified linting and formatting replacing ESLint + Prettier",
	},
];

const apiReferenceUrl = `${env.EXPO_PUBLIC_SERVER_URL}/api-reference`;

export default function About() {
	return (
		<ScrollView className="flex-1 bg-background">
			<View className="gap-4 p-5">
				<Text className="font-semibold text-2xl text-foreground">About</Text>
				<Text className="text-muted-foreground text-sm">
					Learn more about this application and its features.
				</Text>

				<Card>
					<CardHeader>
						<CardTitle>Tech Stack</CardTitle>
					</CardHeader>
					<CardContent className="gap-4">
						{techStack.map((item) => (
							<View key={item.name} className="flex-row items-start gap-3">
								<View className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
								<View className="flex-1">
									<Text className="font-medium text-sm">{item.name}</Text>
									<Text className="text-muted-foreground text-sm">
										{item.description}
									</Text>
								</View>
							</View>
						))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Server</CardTitle>
					</CardHeader>
					<CardContent className="gap-2">
						<Text className="text-muted-foreground text-sm">
							This app talks to the platform API server over type-safe oRPC.
						</Text>
						<Text className="text-foreground text-sm">
							{env.EXPO_PUBLIC_SERVER_URL}
						</Text>
						{env.EXPO_PUBLIC_NODE_ENV === "development" ? (
							<>
								<Text className="text-muted-foreground text-sm">
									Explore the full API reference powered by OpenAPI (available
									in development).
								</Text>
								<Pressable onPress={() => Linking.openURL(apiReferenceUrl)}>
									<Text className="text-primary text-sm">
										{apiReferenceUrl}
									</Text>
								</Pressable>
							</>
						) : null}
					</CardContent>
				</Card>
			</View>
		</ScrollView>
	);
}
