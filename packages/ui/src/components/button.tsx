"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@repo/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive-foreground aria-invalid:ring-destructive-foreground/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			tone: {
				primary: "",
				secondary: "",
				success: "",
				destructive: "",
				warning: "",
			},
			variant: {
				solid: "hover:shadow-[inset_0_0_0_100px_rgba(0,0,0,0.08)]",
				outline: "border bg-transparent",
				ghost: "bg-transparent",
				link: "bg-transparent underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1.5 rounded-md px-3 text-xs has-[>svg]:px-2.5",
				lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		compoundVariants: [
			// Primary
			{ tone: "primary", variant: "solid", className: "bg-primary text-primary-foreground" },
			{ tone: "primary", variant: "outline", className: "border-primary text-primary hover:bg-primary/10" },
			{ tone: "primary", variant: "ghost", className: "text-primary hover:bg-primary/10" },
			{ tone: "primary", variant: "link", className: "text-primary" },
			// Secondary
			{ tone: "secondary", variant: "solid", className: "bg-muted text-muted-foreground" },
			{ tone: "secondary", variant: "outline", className: "border-muted-foreground text-muted-foreground hover:bg-muted" },
			{ tone: "secondary", variant: "ghost", className: "text-muted-foreground hover:bg-muted" },
			{ tone: "secondary", variant: "link", className: "text-muted-foreground" },
			// Success
			{ tone: "success", variant: "solid", className: "bg-success-foreground text-success" },
			{ tone: "success", variant: "outline", className: "border-success-foreground text-success-foreground hover:bg-success" },
			{ tone: "success", variant: "ghost", className: "text-success-foreground hover:bg-success" },
			{ tone: "success", variant: "link", className: "text-success-foreground" },
			// Destructive
			{ tone: "destructive", variant: "solid", className: "bg-destructive-foreground text-destructive" },
			{ tone: "destructive", variant: "outline", className: "border-destructive-foreground text-destructive-foreground hover:bg-destructive" },
			{ tone: "destructive", variant: "ghost", className: "text-destructive-foreground hover:bg-destructive" },
			{ tone: "destructive", variant: "link", className: "text-destructive-foreground" },
			// Warning
			{ tone: "warning", variant: "solid", className: "bg-warning-foreground text-warning" },
			{ tone: "warning", variant: "outline", className: "border-warning-foreground text-warning-foreground hover:bg-warning" },
			{ tone: "warning", variant: "ghost", className: "text-warning-foreground hover:bg-warning" },
			{ tone: "warning", variant: "link", className: "text-warning-foreground" },
		],
		defaultVariants: {
			tone: "primary",
			variant: "solid",
			size: "default",
		},
	},
);

function Button({
	className,
	tone = "primary",
	variant = "solid",
	size = "default",
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={cn(buttonVariants({ tone, variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
