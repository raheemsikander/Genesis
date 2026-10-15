import type { ComponentProps, ComponentType, ReactElement } from "react";
import {
	type FlatListProps,
	FlatList as RNFlatList,
	Pressable as RNPressable,
	ScrollView as RNScrollView,
	Text as RNText,
	TextInput as RNTextInput,
	View as RNView,
} from "react-native";
import { useCssElement } from "react-native-css";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

/**
 * Tailwind/NativeWind v5 maps `className` to `style` per element via `useCssElement`.
 * The Metro config disables the global className polyfill, so components must be wrapped
 * here and imported from `../tw` (not directly from react-native) to accept `className`.
 * Return types are annotated to keep TypeScript from materialising the components' large
 * prop unions (notably Pressable).
 */
export const View = (
	props: ComponentProps<typeof RNView> & { className?: string },
): ReactElement => useCssElement(RNView, props, { className: "style" });

export const Text = (
	props: ComponentProps<typeof RNText> & { className?: string },
): ReactElement => useCssElement(RNText, props, { className: "style" });

export const Pressable = (
	props: ComponentProps<typeof RNPressable> & { className?: string },
): ReactElement =>
	// The minimal ComponentType cap stops useCssElement inferring Pressable's oversized prop
	// union (TS2590); the public signature above stays fully typed.
	useCssElement(RNPressable as ComponentType<{ style?: unknown }>, props, {
		className: "style",
	});

export const TextInput = (
	props: ComponentProps<typeof RNTextInput> & { className?: string },
): ReactElement => useCssElement(RNTextInput, props, { className: "style" });

export const SafeAreaView = (
	props: ComponentProps<typeof RNSafeAreaView> & { className?: string },
): ReactElement => useCssElement(RNSafeAreaView, props, { className: "style" });

export const ScrollView = (
	props: ComponentProps<typeof RNScrollView> & {
		className?: string;
		contentContainerClassName?: string;
	},
): ReactElement =>
	useCssElement(
		RNScrollView as ComponentType<{
			style?: unknown;
			contentContainerStyle?: unknown;
		}>,
		props,
		{
			className: "style",
			contentContainerClassName: "contentContainerStyle",
		},
	);

export function FlatList<ItemT>(
	props: FlatListProps<ItemT> & {
		className?: string;
		contentContainerClassName?: string;
	},
): ReactElement {
	return useCssElement(
		RNFlatList as unknown as ComponentType<{
			style?: unknown;
			contentContainerStyle?: unknown;
		}>,
		props,
		{ className: "style", contentContainerClassName: "contentContainerStyle" },
	);
}
