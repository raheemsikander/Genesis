import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../hooks/use-native-header-options";

export default function UsersTabLayout() {
	const screenOptions = useNativeHeaderOptions({ largeTitle: true });
	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen name="users" options={{ title: "Users" }} />
		</Stack>
	);
}
