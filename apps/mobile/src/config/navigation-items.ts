import type { Href } from "expo-router";

export type MoreLink = {
	title: string;
	description: string;
	href: Href;
	/** SF Symbol shown by the native iOS list row (see more-list.ios.tsx). */
	sfSymbol: string;
	/** Native iOS list section this row belongs to (see more-list.ios.tsx). */
	section: "account" | "platform";
};

export const moreLinks: MoreLink[] = [
	{
		title: "Profile",
		description: "Your account details",
		href: "/profile",
		sfSymbol: "person.crop.circle",
		section: "account",
	},
	{
		title: "Complete profile",
		description: "Set your name and role",
		href: "/complete-profile",
		sfSymbol: "person.text.rectangle",
		section: "account",
	},
	{
		title: "About",
		description: "Tech stack and links",
		href: "/about",
		sfSymbol: "info.circle",
		section: "platform",
	},
	{
		title: "Email",
		description: "Send an invite email",
		href: "/email",
		sfSymbol: "envelope",
		section: "platform",
	},
	{
		title: "Colors",
		description: "Design tokens",
		href: "/colors",
		sfSymbol: "paintpalette",
		section: "platform",
	},
	{
		title: "Typography",
		description: "Text styles",
		href: "/typography",
		sfSymbol: "textformat",
		section: "platform",
	},
	{
		title: "Components",
		description: "UI primitives",
		href: "/components",
		sfSymbol: "square.grid.2x2",
		section: "platform",
	},
];
