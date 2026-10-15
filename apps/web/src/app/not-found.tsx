import { auth } from "@clerk/nextjs/server";
import { Button } from "@repo/ui/components/button";
import Link from "next/link";
import { ErrorDisplay } from "../components/error-display";

export default async function NotFound() {
	const { userId } = await auth();
	const [href, label] = userId
		? (["/portal", "Back to dashboard"] as const)
		: (["/", "Go home"] as const);

	return (
		<ErrorDisplay
			title="Page not found"
			description="The page you're looking for doesn't exist or has been moved."
			actions={<Button render={<Link href={href} />}>{label}</Button>}
		/>
	);
}
