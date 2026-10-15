import { implement } from "@orpc/server";
import { appContract } from "@repo/orpc-contracts";
import type { UserPreferences, UserSchema } from "@repo/shared";

export const TEST_USER: UserSchema = {
	uuid: "550e8400-e29b-41d4-a716-446655440000",
	email: "test@example.com",
	name: "Test User",
	role: "member",
	imageUrl: "https://example.com/avatar.png",
	preferences: { theme: "dark" as const },
	createdBy: null,
	createdAt: new Date("2025-01-01T00:00:00.000Z"),
	updatedBy: null,
	updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

let userPreferences: UserPreferences = { ...TEST_USER.preferences };

export const userHandlers = {
	me: implement(appContract.user.me).handler(() => TEST_USER),
	getPreferences: implement(appContract.user.getPreferences).handler(
		() => userPreferences,
	),
	setPreferences: implement(appContract.user.setPreferences).handler(
		({ input }) => {
			userPreferences = { ...userPreferences, ...input };
			return userPreferences;
		},
	),
};

export function resetUserMocks() {
	userPreferences = { ...TEST_USER.preferences };
}
