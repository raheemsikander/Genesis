import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTabTintColor } from "../../../hooks/use-tab-tint-color";

/**
 * Native tab bar: liquid glass on iOS 26+, Material 3 bottom navigation on
 * Android. Each tab wraps its screen in a Stack (see the group `_layout.tsx`
 * files), since native tabs render no headers themselves.
 */
export default function TabsLayout() {
	const tintColor = useTabTintColor();

	return (
		<NativeTabs tintColor={tintColor} minimizeBehavior="onScrollDown">
			<NativeTabs.Trigger name="(home)">
				<NativeTabs.Trigger.Icon
					sf={{ default: "house", selected: "house.fill" }}
					md="home"
				/>
				<NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="(users)">
				<NativeTabs.Trigger.Icon
					sf={{ default: "person.2", selected: "person.2.fill" }}
					md="group"
				/>
				<NativeTabs.Trigger.Label>Users</NativeTabs.Trigger.Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="(storage)">
				<NativeTabs.Trigger.Icon
					sf={{ default: "folder", selected: "folder.fill" }}
					md="folder"
				/>
				<NativeTabs.Trigger.Label>Storage</NativeTabs.Trigger.Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="(more)">
				<NativeTabs.Trigger.Icon sf="ellipsis" md="more_horiz" />
				<NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
