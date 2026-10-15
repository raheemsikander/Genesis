import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { moreLinks } from "../config/navigation-items";
import { Button, Card, Text } from "./ui";

/**
 * Android variant of the More screen list (iOS uses a native SwiftUI Form,
 * see `more-list.ios.tsx`).
 */
export function MoreList() {
	const { signOut } = useAuth();
	const router = useRouter();
	return (
		<ScrollView
			className="flex-1 bg-background"
			contentInsetAdjustmentBehavior="automatic"
		>
			<View className="gap-3 p-5">
				{moreLinks.map((link) => (
					<Pressable key={link.title} onPress={() => router.push(link.href)}>
						<Card className="gap-3 p-5">
							<Text className="font-medium text-base text-foreground">
								{link.title}
							</Text>
							<Text className="text-muted-foreground text-sm">
								{link.description}
							</Text>
						</Card>
					</Pressable>
				))}
				<Button
					label="Sign out"
					variant="destructive"
					onPress={() => signOut()}
					className="mt-2"
				/>
			</View>
		</ScrollView>
	);
}
