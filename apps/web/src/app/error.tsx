"use client";

import { Button } from "@repo/ui/components/button";
import { useRollbar } from "@rollbar/react";
import Link from "next/link";
import { useEffect } from "react";
import { ErrorDisplay } from "../components/error-display";

interface ErrorPageProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
	const rollbar = useRollbar();

	useEffect(() => {
		rollbar.error(error);
	}, [error, rollbar]);

	return (
		<ErrorDisplay
			title="Something went wrong"
			description="An unexpected error occurred. Our team has been notified."
			referenceId={error.digest}
			actions={
				<>
					<Button onClick={reset}>Try again</Button>
					<Button variant="outline" tone="secondary" render={<Link href="/" />}>
						Go home
					</Button>
				</>
			}
		/>
	);
}
