"use client";

import { Button } from "@repo/ui/components/button";
import { useRollbar } from "@rollbar/react";
import Link from "next/link";
import { useEffect } from "react";
import { ErrorDisplay } from "../../components/error-display";

interface PortalErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function PortalError({ error, reset }: PortalErrorProps) {
	const rollbar = useRollbar();

	useEffect(() => {
		rollbar.error(error);
	}, [error, rollbar]);

	return (
		<ErrorDisplay
			title="Something went wrong"
			description="This page failed to load. You can retry, or head back to the dashboard."
			referenceId={error.digest}
			actions={
				<>
					<Button onClick={reset}>Try again</Button>
					<Button
						variant="outline"
						tone="secondary"
						render={<Link href="/portal" />}
					>
						Back to dashboard
					</Button>
				</>
			}
		/>
	);
}
