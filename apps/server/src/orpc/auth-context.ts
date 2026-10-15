import { getAuth } from "@clerk/express";
import type { Request } from "express";

export async function createAuthContext(opts: { req: Request }) {
	const auth = getAuth(opts.req);

	return {
		clerkId: auth.userId,
		requestId: opts.req.id as string, // For passing to BullMQ job payloads
	};
}

export type AuthContext = Awaited<ReturnType<typeof createAuthContext>>;
