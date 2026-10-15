import type { ColorSchemeName } from "react-native";

/**
 * Native chrome color tokens mirroring src/global.css design tokens.
 * Native APIs (header options, tab tint, Compose/SwiftUI colors) require raw
 * hex values -- they cannot read className. Update this file AND src/global.css
 * together whenever tokens change.
 */
export const nativeTokens = {
	light: {
		background: "#f9f8fc",
		foreground: "#302d50",
		primary: "#2c429d",
		primaryForeground: "#ffffff",
		destructive: "#b34457",
		destructiveForeground: "#ffffff",
	},
	dark: {
		background: "#15141e",
		foreground: "#e8e6ef",
		primary: "#cbb8ff",
		primaryForeground: "#15141e",
		destructive: "#f3a3b1",
		destructiveForeground: "#15141e",
	},
} as const;

export function resolveScheme(scheme: ColorSchemeName): "light" | "dark" {
	return scheme === "dark" ? "dark" : "light";
}
