import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text as RNText, type Role } from "react-native";
import { cn } from "@/utils/cn";

const textVariants = cva("text-base text-foreground", {
	variants: {
		variant: {
			default: "",
			h1: "text-center font-extrabold text-4xl tracking-tight",
			h2: "border-border border-b pb-2 font-semibold text-3xl tracking-tight",
			h3: "font-semibold text-2xl tracking-tight",
			h4: "font-semibold text-xl tracking-tight",
			p: "mt-3 leading-7 sm:mt-6",
			blockquote: "mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6",
			code: cn(
				"relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono font-semibold text-sm",
			),
			lead: "text-muted-foreground text-xl",
			large: "font-semibold text-lg",
			small: "font-medium text-sm leading-none",
			muted: "text-muted-foreground text-sm",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps["variant"]>;

const ROLE: Partial<Record<TextVariant, Role>> = {
	h1: "heading",
	h2: "heading",
	h3: "heading",
	h4: "heading",
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
	h1: "1",
	h2: "2",
	h3: "3",
	h4: "4",
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
	className,
	asChild = false,
	variant = "default",
	...props
}: React.ComponentProps<typeof RNText> &
	React.RefAttributes<typeof RNText> &
	TextVariantProps & {
		asChild?: boolean;
	}) {
	const textClass = React.useContext(TextClassContext);
	const Component = asChild ? Slot : RNText;
	return (
		<Component
			className={cn(textVariants({ variant }), textClass, className)}
			role={variant ? ROLE[variant] : undefined}
			aria-level={variant ? ARIA_LEVEL[variant] : undefined}
			{...props}
		/>
	);
}

export { Text, TextClassContext };
