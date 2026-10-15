import {
	Badge,
	Button,
	Card,
	Input,
	Label,
	Separator,
	Spinner,
} from "../../components/ui";
import { ScrollView, Text, View } from "../../tw";

export default function Components() {
	return (
		<ScrollView className="flex-1 bg-background">
			<View className="gap-4 p-5">
				<Text className="font-semibold text-2xl text-foreground">
					Components
				</Text>

				<Card>
					<Label>Buttons</Label>
					<Button>Primary solid</Button>
					<Button tone="primary" variant="outline">
						Primary outline
					</Button>
					<Button tone="muted" variant="outline">
						Muted outline
					</Button>
					<Button tone="destructive">Destructive</Button>
				</Card>

				<Card>
					<Label>Badges</Label>
					<View className="flex-row gap-2">
						<Badge>Default</Badge>
						<Badge>Another</Badge>
					</View>
				</Card>

				<Card>
					<Label>Input</Label>
					<Input placeholder="Type here" />
					<Input placeholder="Invalid" invalid />
				</Card>

				<Card>
					<Label>Separator + Spinner</Label>
					<Separator />
					<Spinner />
				</Card>
			</View>
		</ScrollView>
	);
}
