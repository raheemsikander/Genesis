"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { useState } from "react";
import { toast } from "sonner";
import { BaseLayout } from "../../../components/base-layout";

interface ColorInfo {
	name: string;
	variable: string;
}

interface ColorGroup {
	title: string;
	colors: ColorInfo[];
}

const colorGroups: ColorGroup[] = [
	{
		title: "Core",
		colors: [
			{ name: "background", variable: "--background" },
			{ name: "foreground", variable: "--foreground" },
		],
	},
	{
		title: "Brand",
		colors: [
			{ name: "primary", variable: "--primary" },
			{ name: "primary-foreground", variable: "--primary-foreground" },
			{ name: "secondary", variable: "--secondary" },
			{ name: "secondary-foreground", variable: "--secondary-foreground" },
			{ name: "muted", variable: "--muted" },
			{ name: "muted-foreground", variable: "--muted-foreground" },
			{ name: "accent", variable: "--accent" },
			{ name: "accent-foreground", variable: "--accent-foreground" },
		],
	},
	{
		title: "Surfaces",
		colors: [
			{ name: "card", variable: "--card" },
			{ name: "card-foreground", variable: "--card-foreground" },
			{ name: "popover", variable: "--popover" },
			{ name: "popover-foreground", variable: "--popover-foreground" },
		],
	},
	{
		title: "Borders & Rings",
		colors: [
			{ name: "border", variable: "--border" },
			{ name: "input", variable: "--input" },
			{ name: "ring", variable: "--ring" },
		],
	},
	{
		title: "State",
		colors: [
			{ name: "destructive", variable: "--destructive" },
			{ name: "destructive-foreground", variable: "--destructive-foreground" },
			{ name: "success", variable: "--success" },
			{ name: "success-foreground", variable: "--success-foreground" },
			{ name: "warning", variable: "--warning" },
			{ name: "warning-foreground", variable: "--warning-foreground" },
			{ name: "info", variable: "--info" },
			{ name: "info-foreground", variable: "--info-foreground" },
		],
	},
	{
		title: "Chart",
		colors: [
			{ name: "chart-1", variable: "--chart-1" },
			{ name: "chart-2", variable: "--chart-2" },
			{ name: "chart-3", variable: "--chart-3" },
			{ name: "chart-4", variable: "--chart-4" },
			{ name: "chart-5", variable: "--chart-5" },
		],
	},
];

export default function ColorsPage() {
	const [copied, setCopied] = useState<string | null>(null);

	const copyToClipboard = async (text: string, label: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(text);
			toast.success("Copied!", { description: label });
			setTimeout(() => setCopied(null), 1500);
		} catch {
			toast.error("Failed to copy", { description: "Please copy manually." });
		}
	};

	return (
		<BaseLayout
			title="Color Palette"
			description="Click any swatch to copy its CSS variable."
		>
			<div className="space-y-6">
				{colorGroups.map((group) => (
					<Card key={group.title}>
						<CardHeader>
							<CardTitle>{group.title}</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
								{group.colors.map((color) => (
									<button
										key={color.name}
										type="button"
										onClick={() =>
											copyToClipboard(`var(${color.variable})`, color.name)
										}
										className="group overflow-hidden rounded-md border border-border text-left transition hover:-translate-y-0.5 hover:shadow-md"
									>
										<div
											className="h-16 w-full border-border border-b"
											style={{ background: `var(${color.variable})` }}
										/>
										<div className="bg-card p-2.5">
											<p className="font-medium font-mono text-foreground text-xs">
												{color.name}
											</p>
											<p
												className={`mt-0.5 font-mono text-xs transition ${copied === `var(${color.variable})` ? "text-primary" : "text-muted-foreground"}`}
											>
												{copied === `var(${color.variable})`
													? "Copied!"
													: `var(${color.variable})`}
											</p>
										</div>
									</button>
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</BaseLayout>
	);
}
