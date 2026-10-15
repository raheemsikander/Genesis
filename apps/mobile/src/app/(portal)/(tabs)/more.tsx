import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Button, Card } from "../../../components/ui";
import { moreLinks } from "../../../config/navigation-items";
import { Pressable, ScrollView, Text, View } from "../../../tw";

export default function More() {
	const { signOut } = useAuth();
	const router = useRouter();
	return (
		<ScrollView className="flex-1 bg-background">
			<View className="gap-3 p-5">
				{moreLinks.map((link) => (
					<Pressable key={link.title} onPress={() => router.push(link.href)}>
						<Card>
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
					tone="destructive"
					variant="outline"
					onPress={() => signOut()}
					className="mt-2"
				>
					Sign out
				</Button>
			</View>
		</ScrollView>
	);
}
