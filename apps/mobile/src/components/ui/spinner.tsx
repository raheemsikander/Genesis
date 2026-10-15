import { ActivityIndicator, View } from "react-native";

export function Spinner() {
	return (
		<View className="items-center justify-center p-4">
			<ActivityIndicator />
		</View>
	);
}
