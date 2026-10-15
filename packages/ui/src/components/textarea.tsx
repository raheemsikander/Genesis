import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"min-h-[80px] w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive-foreground aria-invalid:focus-visible:ring-1 aria-invalid:focus-visible:ring-destructive-foreground/25 dark:bg-input/30 dark:aria-invalid:border-destructive-foreground dark:aria-invalid:focus-visible:ring-destructive-foreground/25 dark:disabled:bg-input/80",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
