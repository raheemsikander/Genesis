import type { ReactNode } from "react";
import { Text } from "../../tw";

export function Label({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<Text className={`font-medium text-foreground text-sm ${className}`}>
			{children}
		</Text>
	);
}
