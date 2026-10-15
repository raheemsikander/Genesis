import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../hooks/use-native-header-options";

export default function MoreTabLayout() {
	const screenOptions = useNativeHeaderOptions({ largeTitle: true });
	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen name="more" options={{ title: "More" }} />
		</Stack>
	);
}
