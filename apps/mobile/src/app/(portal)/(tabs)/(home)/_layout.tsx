import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../hooks/use-native-header-options";

export default function HomeTabLayout() {
	const screenOptions = useNativeHeaderOptions({ largeTitle: true });
	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen name="index" options={{ title: "Home" }} />
		</Stack>
	);
}
