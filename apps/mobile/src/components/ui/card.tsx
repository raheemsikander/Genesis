import type { ReactNode } from "react";
import { View } from "../../tw";

export function Card({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<View
			className={`gap-3 rounded-2xl border border-border bg-card p-5 ${className}`}
		>
			{children}
		</View>
	);
}
