import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { type ColorValue, useColorScheme } from "react-native";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Tab tints can't come from `className` (the tab bar is configured via JS options), so the
 * active/inactive colors are resolved from the color scheme to match the `primary` /
 * `muted-foreground` design tokens in `src/global.css`.
 */
export default function TabsLayout() {
	const scheme = useColorScheme();
	const activeTint = scheme === "dark" ? "#cbb8ff" : "#2c429d";
	const inactiveTint = scheme === "dark" ? "#a8a8a8" : "#4a4968";

	const icon =
		(name: IconName) =>
		({ color, size }: { color: ColorValue; size: number }) => (
			<Ionicons name={name} color={color} size={size} />
		);

	return (
		<Tabs
			screenOptions={{
				headerShown: true,
				tabBarActiveTintColor: activeTint,
				tabBarInactiveTintColor: inactiveTint,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{ title: "Home", tabBarIcon: icon("home-outline") }}
			/>
			<Tabs.Screen
				name="users"
				options={{ title: "Users", tabBarIcon: icon("people-outline") }}
			/>
			<Tabs.Screen
				name="storage"
				options={{ title: "Storage", tabBarIcon: icon("folder-outline") }}
			/>
			<Tabs.Screen
				name="video-lab"
				options={{ title: "Lab", tabBarIcon: icon("videocam-outline") }}
			/>
			<Tabs.Screen
				name="speech-lab"
				options={{ title: "Speech", tabBarIcon: icon("mic-outline") }}
			/>
			<Tabs.Screen
				name="more"
				options={{ title: "More", tabBarIcon: icon("ellipsis-horizontal") }}
			/>
		</Tabs>
	);
}
