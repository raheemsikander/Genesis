import { View } from "../../tw";

export function Separator({ className = "" }: { className?: string }) {
	return <View className={`h-px bg-border ${className}`} />;
}
