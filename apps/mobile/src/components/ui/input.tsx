import { TextInput, useColorScheme } from "react-native";
import { cn } from "@/utils/cn";
import { nativeTokens, resolveScheme } from "../../theme/native-tokens";

const selectionTint = {
	light: nativeTokens.light.primary,
	dark: nativeTokens.dark.primary,
};

function Input({
	className,
	...props
}: React.ComponentProps<typeof TextInput> &
	React.RefAttributes<TextInput> & {
		/**
		 * Typed locally: uniwind 1.7.0 types don't declare this prop yet (added in
		 * 1.8.0). Kept in `props` so it forwards to TextInput, where uniwind reads
		 * it at runtime.
		 */
		placeholderClassName?: string;
	}) {
	const scheme = useColorScheme();
	return (
		<TextInput
			// Native-feel defaults: iOS clear button + primary-tinted caret/selection.
			clearButtonMode="while-editing"
			selectionColor={selectionTint[resolveScheme(scheme)]}
			className={cn(
				"flex h-10 w-full min-w-0 flex-row items-center rounded-md border border-input bg-background px-3 py-1 text-base text-foreground leading-5 shadow-black/5 shadow-sm sm:h-9 dark:bg-input/30",
				props.editable === false && "opacity-50",
				"placeholder:text-muted-foreground/50",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
