import { Link } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { Text } from "react-native";

export function TextLink({
	href,
	children,
	className = "",
}: {
	href: ComponentProps<typeof Link>["href"];
	children: ReactNode;
	className?: string;
}) {
	return (
		<Link href={href} asChild>
			<Text className={`text-primary text-sm ${className}`}>{children}</Text>
		</Link>
	);
}
