import { z } from "zod";

export const UserRoleEnum = z.enum(["admin", "member"]);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const Roles = {
	ADMIN: "admin",
	MEMBER: "member",
} as const satisfies Record<string, UserRole>;

export const UserPreferences = z.looseObject({
	theme: z.enum(["light", "dark", "system"]).optional(),
});

export type UserPreferences = z.infer<typeof UserPreferences>;

export const UserSchema = z.object({
	uuid: z.string().uuid(),
	email: z.string(),
	name: z.string(),
	role: UserRoleEnum,
	imageUrl: z.string().nullable(),
	preferences: UserPreferences,
	createdBy: z.string().uuid().nullable(),
	createdAt: z.date(),
	updatedBy: z.string().uuid().nullable(),
	updatedAt: z.date(),
});

export type UserSchema = z.infer<typeof UserSchema>;

export const UserListItem = z.object({
	uuid: z.string().uuid(),
	email: z.string(),
	name: z.string(),
	role: UserRoleEnum,
	imageUrl: z.string().nullable(),
	createdAt: z.date(),
});

export type UserListItem = z.infer<typeof UserListItem>;

export const UserList = z.object({
	users: z.array(UserListItem),
});

export type UserList = z.infer<typeof UserList>;
