import { cn } from "@repo/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const badgeVariants = cva(
	"inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold",
	{
		variants: {
			tone: {
				primary: "",
				secondary: "",
				success: "",
				destructive: "",
				warning: "",
				info: "",
			},
			variant: {
				solid: "",
				outline: "bg-transparent border",
			},
		},
		compoundVariants: [
			// Primary
			{ tone: "primary", variant: "solid", className: "bg-primary text-primary-foreground" },
			{ tone: "primary", variant: "outline", className: "border-primary text-primary" },
			// Secondary
			{ tone: "secondary", variant: "solid", className: "bg-muted text-muted-foreground" },
			{ tone: "secondary", variant: "outline", className: "border-muted-foreground text-muted-foreground" },
			// Success
			{ tone: "success", variant: "solid", className: "bg-success-foreground text-success" },
			{ tone: "success", variant: "outline", className: "border-success-foreground text-success-foreground" },
			// Destructive
			{ tone: "destructive", variant: "solid", className: "bg-destructive-foreground text-destructive" },
			{ tone: "destructive", variant: "outline", className: "border-destructive-foreground text-destructive-foreground" },
			// Warning
			{ tone: "warning", variant: "solid", className: "bg-warning-foreground text-warning" },
			{ tone: "warning", variant: "outline", className: "border-warning-foreground text-warning-foreground" },
			// Info
			{ tone: "info", variant: "solid", className: "bg-info-foreground text-info" },
			{ tone: "info", variant: "outline", className: "border-info-foreground text-info-foreground" },
		],
		defaultVariants: {
			tone: "primary",
			variant: "solid",
		},
	},
);

function Badge({
	className,
	tone = "primary",
	variant = "solid",
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return (
		<span
			data-slot="badge"
			className={cn(badgeVariants({ tone, variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
