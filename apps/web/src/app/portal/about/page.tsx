import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { BaseLayout } from "../../../components/base-layout";
import { env } from "../../../utils/env";

const techStack = [
	{
		name: "React & TypeScript",
		description: "Modern React with full TypeScript support",
	},
	{
		name: "Next.js",
		description:
			"Full-stack React framework with App Router and server components",
	},
	{
		name: "Clerk",
		description: "Complete authentication and user management solution",
	},
	{
		name: "ORPC",
		description: "Type-safe RPC with automatic OpenAPI documentation",
	},
	{
		name: "shadcn/ui",
		description: "Beautiful, accessible components built with Radix primitives",
	},
	{
		name: "Tailwind CSS",
		description: "Utility-first CSS framework for rapid styling",
	},
	{
		name: "Drizzle ORM",
		description:
			"Lightweight, type-safe ORM with schema-first migrations for PostgreSQL",
	},
	{
		name: "Turborepo",
		description: "Monorepo build system for fast, incremental builds",
	},
	{
		name: "Biome",
		description:
			"Fast, unified linting and formatting replacing ESLint + Prettier",
	},
];

export default function AboutPage() {
	return (
		<BaseLayout
			title="About"
			description="Learn more about this application and its features."
		>
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Tech Stack</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{techStack.map((item) => (
							<div key={item.name} className="flex items-start gap-3">
								<div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
								<div>
									<p className="font-medium text-sm">{item.name}</p>
									<p className="text-muted-foreground text-sm">
										{item.description}
									</p>
								</div>
							</div>
						))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>API Documentation</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground text-sm">
							Explore the full API reference powered by OpenAPI.
						</p>
						<a
							href={`${env.NEXT_PUBLIC_SERVER_URL}/api-reference`}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 inline-block text-primary text-sm"
						>
							{`${env.NEXT_PUBLIC_SERVER_URL}/api-reference`}
						</a>
					</CardContent>
				</Card>

				{env.NEXT_PUBLIC_NODE_ENV === "development" && (
					<Card>
						<CardHeader>
							<CardTitle>BullMQ Dashboard</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								Inspect background queues, jobs, and failures. Requires an admin
								role; only mounted in development.
							</p>
							<a
								href={`${env.NEXT_PUBLIC_SERVER_URL}/admin/jobs`}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-2 inline-block text-primary text-sm"
							>
								Open dashboard →
							</a>
						</CardContent>
					</Card>
				)}
			</div>
		</BaseLayout>
	);
}
