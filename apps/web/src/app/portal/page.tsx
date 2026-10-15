"use client";

import { useUser } from "@clerk/nextjs";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { BaseLayout } from "../../components/base-layout";

const dashboardCards = [
	{
		title: "Getting Started",
		description:
			"Your app is now running with a beautiful sidebar powered by Radix UI and Tailwind CSS.",
	},
	{
		title: "Navigation",
		description:
			"Use the sidebar to navigate between different pages. The active page is highlighted.",
	},
	{
		title: "Customization",
		description:
			"Easy to customize navigation items, styling, and add new pages to your application.",
	},
];

export default function PortalDashboard() {
	const { user } = useUser();

	return (
		<BaseLayout
			showBreadcrumb={false}
			title={
				user ? (
					<>
						Welcome Home,{" "}
						<span className="mp-mask">
							{user.firstName ?? user.fullName ?? "there"}
						</span>
						!
					</>
				) : (
					"Home"
				)
			}
			description="This is your dashboard. Navigate using the sidebar to explore different sections."
		>
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{dashboardCards.map((card) => (
					<Card key={card.title}>
						<CardHeader>
							<CardTitle className="text-base">{card.title}</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription>{card.description}</CardDescription>
						</CardContent>
					</Card>
				))}
			</div>
		</BaseLayout>
	);
}
