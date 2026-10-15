import {
	FunctionSquare,
	HardDriveIcon,
	HomeIcon,
	InfoIcon,
	MailIcon,
	PaletteIcon,
	PanelLeftIcon,
	TextIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";
import type { NavigationItem } from "../components/app-sidebar";

export const navigationItems: NavigationItem[] = [
	{
		title: "Home",
		url: "/portal",
		icon: HomeIcon,
	},
	{
		title: "About",
		url: "/portal/about",
		icon: InfoIcon,
	},
	{
		title: "Profile",
		url: "/portal/profile",
		icon: UserIcon,
	},
	{
		title: "Features",
		url: "#",
		icon: FunctionSquare,
		items: [
			{ title: "Email", url: "/portal/email", icon: MailIcon },
			{ title: "Storage", url: "/portal/storage", icon: HardDriveIcon },
			{ title: "Users", url: "/portal/users", icon: UsersIcon },
		],
	},
	{
		title: "Design System",
		url: "#",
		icon: PaletteIcon,
		items: [
			{ title: "Colors", url: "/portal/colors", icon: PaletteIcon },
			{ title: "Typography", url: "/portal/typography", icon: TextIcon },
			{ title: "Components", url: "/portal/components", icon: PanelLeftIcon },
		],
	},
];
