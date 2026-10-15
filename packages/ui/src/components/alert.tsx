import { cn } from "@repo/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const alertVariants = cva(
	"relative w-full border-l-[5px] px-4 py-3 text-sm shadow-md rounded-md",
	{
		variants: {
			variant: {
				success: "bg-success text-success-foreground border-l-success-foreground",
				destructive: "bg-destructive text-destructive-foreground border-l-destructive-foreground",
				warning: "bg-warning text-warning-foreground border-l-warning-foreground",
				info: "bg-info text-info-foreground border-l-info-foreground",
			},
		},
		defaultVariants: {
			variant: "info",
		},
	},
);

function Alert({
	className,
	variant = "info",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn("font-semibold leading-tight mb-0.5", className)}
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn("text-sm opacity-90", className)}
			{...props}
		/>
	);
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-action"
			className={cn("absolute top-3 right-4", className)}
			{...props}
		/>
	);
}

export { Alert, AlertAction, AlertDescription, AlertTitle };
