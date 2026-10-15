import { Switch as NativeSwitch } from "react-native";
import type { SwitchProps } from "./switch-types";

/**
 * Native UISwitch (iOS variant; Android uses the Material 3 Compose switch in
 * `switch.android.tsx`). RN's core Switch is the real platform control, so no
 * SwiftUI Host is needed.
 */
export function Switch({ checked, onCheckedChange, disabled }: SwitchProps) {
	return (
		<NativeSwitch
			value={checked}
			onValueChange={onCheckedChange}
			disabled={disabled}
		/>
	);
}
