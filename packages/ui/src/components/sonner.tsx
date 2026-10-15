"use client";

import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			theme={theme === "dark" ? "dark" : theme === "light" ? "light" : "system"}
			className="toaster group"
			closeButton
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			toastOptions={{
				classNames: {
					toast: "!border-0 !border-l-[5px] !rounded-md !font-semibold !shadow-md !bg-background !text-foreground",
					default: "!bg-background !text-foreground !border-l-border",
					success: "!bg-success !text-success-foreground !border-l-success-foreground",
					error: "!bg-destructive !text-destructive-foreground !border-l-destructive-foreground [&_*]:!text-destructive-foreground",
					warning: "!bg-warning !text-warning-foreground !border-l-warning-foreground",
					info: "!bg-info !text-info-foreground !border-l-info-foreground",
					description: "!text-inherit !opacity-80",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
