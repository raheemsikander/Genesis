import { Redirect } from "expo-router";

export default function SSOCallback() {
	return <Redirect href="/(portal)/(tabs)/(home)" />;
}
