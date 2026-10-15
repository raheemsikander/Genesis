"use client";

import { cn } from "@repo/ui/lib/utils";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "auto";

function getStoredTheme(): ThemeMode {
	if (typeof window === "undefined") return "auto";
	const s = window.localStorage.getItem("theme");
	return s === "light" || s === "dark" || s === "auto" ? s : "auto";
}

function applyTheme(mode: ThemeMode) {
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;
	document.documentElement.classList.remove("light", "dark");
	document.documentElement.classList.add(resolved);
	if (mode === "auto") {
		document.documentElement.removeAttribute("data-theme");
	} else {
		document.documentElement.setAttribute("data-theme", mode);
	}
	document.documentElement.style.colorScheme = resolved;
}

const themeOptions: { mode: ThemeMode; icon: typeof SunIcon; label: string }[] =
	[
		{ mode: "light", icon: SunIcon, label: "Light" },
		{ mode: "dark", icon: MoonIcon, label: "Dark" },
		{ mode: "auto", icon: MonitorIcon, label: "System" },
	];

export function ThemePicker() {
	const [mode, setMode] = useState<ThemeMode>("auto");

	useEffect(() => {
		setMode(getStoredTheme());
	}, []);

	function pick(m: ThemeMode) {
		setMode(m);
		applyTheme(m);
		window.localStorage.setItem("theme", m);
	}

	return (
		<div className="px-3 py-2">
			<p className="section-label mb-1.5">Theme</p>
			<div className="flex gap-1">
				{themeOptions.map(({ mode: m, icon: Icon }) => (
					<button
						key={m}
						type="button"
						onClick={() => pick(m)}
						className={cn(
							"flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-1.5 font-medium text-xs transition",
							mode === m
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-accent hover:text-foreground",
						)}
					>
						<Icon className="h-3.5 w-3.5" />
					</button>
				))}
			</div>
		</div>
	);
}
