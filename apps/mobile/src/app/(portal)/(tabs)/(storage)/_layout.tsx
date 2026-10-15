import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../hooks/use-native-header-options";

export default function StorageTabLayout() {
	const screenOptions = useNativeHeaderOptions({ largeTitle: true });
	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen name="storage" options={{ title: "Storage" }} />
		</Stack>
	);
}
