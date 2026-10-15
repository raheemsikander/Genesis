import type { Href } from "expo-router";

export type MoreLink = {
	title: string;
	description: string;
	href: Href;
};

export const moreLinks: MoreLink[] = [
	{ title: "Profile", description: "Your account details", href: "/profile" },
	{
		title: "Complete profile",
		description: "Set your name and role",
		href: "/complete-profile",
	},
	{ title: "About", description: "Tech stack and links", href: "/about" },
	{ title: "Email", description: "Send an invite email", href: "/email" },
	{ title: "Colors", description: "Design tokens", href: "/colors" },
	{ title: "Typography", description: "Text styles", href: "/typography" },
	{ title: "Components", description: "UI primitives", href: "/components" },
];
