import type { ReactNode } from "react";
import { Text, View } from "../../tw";

export function Badge({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<View
			className={`self-start rounded-full bg-muted px-2.5 py-0.5 ${className}`}
		>
			<Text className="font-medium text-muted-foreground text-xs">
				{children}
			</Text>
		</View>
	);
}
