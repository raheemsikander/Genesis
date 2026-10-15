import { Switch as ComposeSwitch, Host } from "@expo/ui/jetpack-compose";
import type { SwitchProps } from "./switch-types";

/**
 * Material 3 Compose switch (Android variant; iOS uses the native UISwitch in
 * `switch.ios.tsx`).
 */
export function Switch({ checked, onCheckedChange, disabled }: SwitchProps) {
	return (
		<Host matchContents>
			<ComposeSwitch
				value={checked}
				onCheckedChange={onCheckedChange}
				enabled={!disabled}
			/>
		</Host>
	);
}
