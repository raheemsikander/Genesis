import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
	Badge,
	Button,
	Card,
	Input,
	Label,
	Separator,
	Spinner,
	Switch,
	Text,
} from "../../components/ui";

export default function Components() {
	const [switchOn, setSwitchOn] = useState(true);
	return (
		<ScrollView className="flex-1 bg-background">
			<View className="gap-4 p-5">
				<Text className="font-semibold text-2xl text-foreground">
					Components
				</Text>

				<Card className="gap-3 p-5">
					<Label>Buttons</Label>
					<Button label="Default" />
					<Button label="Secondary" variant="secondary" />
					<Button label="Outline" variant="outline" />
					<Button label="Ghost" variant="ghost" />
					<Button label="Destructive" variant="destructive" />
					<Button label="Link" variant="link" />
					<View className="flex-row items-center gap-2">
						<Button label="sm" size="sm" />
						<Button label="lg" size="lg" />
					</View>
					<Button label="Loading" loading />
					<Button label="Disabled" disabled />
				</Card>

				<Card className="gap-3 p-5">
					<Label>Badges</Label>
					<View className="flex-row gap-2">
						<Badge>
							<Text>Default</Text>
						</Badge>
						<Badge variant="secondary">
							<Text>Secondary</Text>
						</Badge>
						<Badge variant="outline">
							<Text>Outline</Text>
						</Badge>
						<Badge variant="destructive">
							<Text>Destructive</Text>
						</Badge>
					</View>
				</Card>

				<Card className="gap-3 p-5">
					<Label>Input</Label>
					<Input placeholder="Type here" />
					<Input placeholder="Invalid" className="border-destructive" />
				</Card>

				<Card className="gap-3 p-5">
					<Label>Separator + Spinner</Label>
					<Separator />
					<Spinner />
				</Card>

				<Card className="gap-3 p-5">
					<Label>Switch</Label>
					<View className="flex-row items-center gap-2">
						<Switch checked={switchOn} onCheckedChange={setSwitchOn} />
						<Text className="text-foreground text-sm">
							{switchOn ? "On" : "Off"}
						</Text>
					</View>
					<Switch checked disabled onCheckedChange={() => undefined} />
				</Card>
			</View>
		</ScrollView>
	);
}
