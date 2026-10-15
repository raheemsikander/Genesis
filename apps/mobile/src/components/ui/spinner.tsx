import { ActivityIndicator } from "react-native";
import { View } from "../../tw";

export function Spinner() {
	return (
		<View className="items-center justify-center p-4">
			<ActivityIndicator />
		</View>
	);
}
