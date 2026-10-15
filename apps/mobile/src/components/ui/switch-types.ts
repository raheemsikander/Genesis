/**
 * Shared props for the native Switch (UISwitch on iOS, Material 3 Compose on
 * Android). Both platform files implement this contract so a props change is
 * caught by tsc even though moduleSuffixes resolves imports to the .ios file.
 * className is deliberately omitted because there is no wrapper View (iOS
 * renders the RN Switch directly; Android renders Host with Compose Switch),
 * so layout must come from a parent container.
 */
export type SwitchProps = {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
};
