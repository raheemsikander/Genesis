import { db } from "../../src/db/db";
import { users } from "../../src/db/schema";
import { TEST_CLERK_USER_ID } from "../helpers/auth.test-helper";

type UserInsert = typeof users.$inferInsert;

export async function createTestUser(overrides?: Partial<UserInsert>) {
	const defaults: UserInsert = {
		clerkId: TEST_CLERK_USER_ID,
		email: "test@example.com",
		name: "Test User",
		role: "member",
		imageUrl: "https://example.com/avatar.png",
		preferences: { theme: "dark" as const },
	};

	const [user] = await db
		.insert(users)
		.values({ ...defaults, ...overrides })
		.returning();

	return user!;
}
