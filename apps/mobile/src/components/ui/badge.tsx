import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import { View } from "react-native";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/utils/cn";

const badgeVariants = cva(
	"group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-full border border-border px-2 py-0.5",
	{
		variants: {
			variant: {
				default: "border-transparent bg-primary",
				secondary: "border-transparent bg-secondary",
				destructive: "border-transparent bg-destructive",
				outline: "",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

const badgeTextVariants = cva("font-medium text-xs", {
	variants: {
		variant: {
			default: "text-primary-foreground",
			secondary: "text-secondary-foreground",
			destructive: "text-white",
			outline: "text-foreground",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

type BadgeProps = React.ComponentProps<typeof View> &
	React.RefAttributes<View> & {
		asChild?: boolean;
	} & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, asChild, ...props }: BadgeProps) {
	const Component = asChild ? Slot : View;
	return (
		<TextClassContext.Provider value={badgeTextVariants({ variant })}>
			<Component
				className={cn(badgeVariants({ variant }), className)}
				{...props}
			/>
		</TextClassContext.Provider>
	);
}

export type { BadgeProps };
export { Badge, badgeTextVariants, badgeVariants };
