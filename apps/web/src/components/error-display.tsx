import type { ReactNode } from "react";

interface ErrorDisplayProps {
	title: string;
	description: string;
	referenceId?: string;
	actions?: ReactNode;
}

export function ErrorDisplay({
	title,
	description,
	referenceId,
	actions,
}: ErrorDisplayProps) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-6">
			<div className="w-full max-w-md rounded-md border border-border bg-card p-6 text-center">
				<h1 className="font-semibold text-foreground text-xl">{title}</h1>
				<p className="mt-2 text-muted-foreground text-sm">{description}</p>
				{referenceId && (
					<p className="mt-4 font-mono text-muted-foreground text-xs">
						Reference: {referenceId}
					</p>
				)}
				{actions && (
					<div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
						{actions}
					</div>
				)}
			</div>
		</div>
	);
}
