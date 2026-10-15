import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Path-segment match: "/portal" matches "/portal/x" but not "/portalish".
function isUnder(prefix: string, pathname: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isProtected(req: NextRequest): boolean {
	return isUnder("/portal", req.nextUrl.pathname);
}

function isAuthPage(req: NextRequest): boolean {
	const path = req.nextUrl.pathname;
	return isUnder("/sign-in", path) || isUnder("/sign-up", path);
}

export default clerkMiddleware(async (auth, req) => {
	let userId: string | null = null;
	try {
		({ userId } = await auth());
	} catch (err) {
		console.error(
			"[middleware] auth() threw — failing closed for /portal/*",
			err,
		);
		// Fail-closed: if Clerk is unreachable or the cookie is malformed,
		// treat protected routes as unauthenticated and let the user re-auth.
	}

	if (userId && isAuthPage(req)) {
		const url = req.nextUrl.clone();
		url.pathname = "/portal";
		url.search = "";
		return NextResponse.redirect(url);
	}

	if (!userId && isProtected(req)) {
		const originalPath = req.nextUrl.pathname + req.nextUrl.search;
		const url = req.nextUrl.clone();
		url.pathname = "/sign-in";
		url.search = "";
		url.searchParams.set("redirect_url", originalPath);
		return NextResponse.redirect(url);
	}
});

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)).*)",
	],
};
