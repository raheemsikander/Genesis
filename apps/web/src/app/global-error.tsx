"use client";

import "../index.css";
import { Button } from "@repo/ui/components/button";
import { useEffect } from "react";
import { ErrorDisplay } from "../components/error-display";
import { rollbar } from "../utils/rollbar";

interface GlobalErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

const themeInitScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function GlobalError({ error, reset }: GlobalErrorProps) {
	useEffect(() => {
		rollbar.error(error);
	}, [error]);

	return (
		<html lang="en">
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
			</head>
			<body className="antialiased">
				<ErrorDisplay
					title="Something went wrong"
					description="A critical error occurred. Our team has been notified."
					referenceId={error.digest}
					actions={<Button onClick={reset}>Try again</Button>}
				/>
			</body>
		</html>
	);
}
