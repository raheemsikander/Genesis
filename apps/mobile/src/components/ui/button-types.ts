/**
 * Shared props for the native Button (SwiftUI on iOS, Material 3 Compose on
 * Android). Label-based by design: native buttons take a string label, not RN
 * `<Text>` children. With tsconfig moduleSuffixes, tsc resolves imports to the
 * .ios file only, so both platform files must implement this contract to keep
 * the Android variant type-safe.
 */
export type ButtonProps = {
	label: string;
	onPress?: () => void;
	variant?:
		| "default"
		| "secondary"
		| "outline"
		| "ghost"
		| "link"
		| "destructive";
	size?: "sm" | "default" | "lg";
	/** Shows a native spinner next to the label and disables the button. */
	loading?: boolean;
	disabled?: boolean;
	/** Layout-only classes (margins, alignment) applied to the RN wrapper View. */
	className?: string;
};
