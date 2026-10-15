import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { BaseLayout } from "../../../components/base-layout";

const headingStyles = [
	{
		level: "Heading 1",
		element: "h1" as const,
		description: "text-3xl (30px), font-bold, leading-tight",
	},
	{
		level: "Heading 2",
		element: "h2" as const,
		description: "text-2xl (24px), font-bold, leading-tight",
	},
	{
		level: "Heading 3",
		element: "h3" as const,
		description: "text-xl (20px), font-semibold, leading-normal",
	},
	{
		level: "Heading 4",
		element: "h4" as const,
		description: "text-lg (18px), font-semibold, leading-normal",
	},
	{
		level: "Heading 5",
		element: "h5" as const,
		description: "text-base (16px), font-semibold, leading-normal",
	},
	{
		level: "Heading 6",
		element: "h6" as const,
		description: "text-sm (14px), font-semibold, leading-normal",
	},
];

export default function TypographyPage() {
	return (
		<BaseLayout
			title="Typography"
			description="Heading styles, body text, and font families."
		>
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Headings</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{headingStyles.map((style) => {
							const HeadingTag = style.element;
							return (
								<div key={style.level}>
									<HeadingTag>{style.level}</HeadingTag>
									<p className="mt-1 text-muted-foreground text-xs">
										{style.description}
									</p>
								</div>
							);
						})}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Body Text</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<p className="text-base text-foreground">
								Large — emphasis content at 16px.
							</p>
							<p className="text-muted-foreground text-xs">text-base</p>
						</div>
						<div>
							<p className="text-foreground text-sm">
								Body — default content at 14px.
							</p>
							<p className="text-muted-foreground text-xs">text-sm</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">
								Caption — helper information at 12px.
							</p>
							<p className="text-muted-foreground text-xs">text-xs</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Font Families</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="rounded-md border border-border bg-background p-4">
							<p className="section-label mb-2">Body — Manrope</p>
							<p className="font-medium text-2xl text-foreground">
								The quick brown fox jumps over the lazy dog.
							</p>
							<p className="mt-1 text-muted-foreground text-xs">
								Weights: 400–800 — loaded via Google Fonts
							</p>
						</div>
						<div className="rounded-md border border-border bg-background p-4">
							<p className="section-label mb-2">Display — Fraunces</p>
							<p className="display-title font-bold text-2xl text-foreground">
								The quick brown fox jumps over the lazy dog.
							</p>
							<p className="mt-1 text-muted-foreground text-xs">
								Optical size 9–144, weights 500 &amp; 700 — use via
								.display-title class
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</BaseLayout>
	);
}
