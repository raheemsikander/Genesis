"use client";

import { CheckIcon, CircleIcon } from "lucide-react";

interface PasswordRequirementProps {
	met: boolean;
	neutral: boolean;
	label: string;
}

export function PasswordRequirement({
	met,
	neutral,
	label,
}: PasswordRequirementProps) {
	if (neutral) {
		return (
			<div className="flex items-center gap-1.5">
				<CircleIcon className="h-3 w-3 text-muted-foreground/50" />
				<span className="text-muted-foreground/70 text-xs">{label}</span>
			</div>
		);
	}
	return (
		<div className="flex items-center gap-1.5">
			<CheckIcon
				className={`h-3.5 w-3.5 ${met ? "text-success-foreground" : "text-muted-foreground/50"}`}
			/>
			<span
				className={`text-xs ${met ? "text-success-foreground" : "text-muted-foreground/70"}`}
			>
				{label}
			</span>
		</div>
	);
}
