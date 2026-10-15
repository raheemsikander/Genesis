import { z } from "zod";
import { UserRoleEnum } from "./user.types";

export const PASSWORD_RULES = {
	minLength: 8,
} as const;

export const PasswordSchema = z
	.string()
	.min(
		PASSWORD_RULES.minLength,
		`Must be at least ${PASSWORD_RULES.minLength} characters`,
	)
	.regex(/[A-Z]/, "Must contain at least one uppercase letter")
	.regex(/[a-z]/, "Must contain at least one lowercase letter")
	.regex(/[0-9]/, "Must contain at least one digit")
	.regex(/[^A-Za-z0-9]/, "Must contain at least one special character");

export const CompleteProfileInput = z.object({
	name: z.string().min(1, "Name is required").max(100),
	role: UserRoleEnum,
});

export type CompleteProfileInput = z.infer<typeof CompleteProfileInput>;

export const AuthSuccess = z.object({
	success: z.literal(true),
});

export type AuthSuccess = z.infer<typeof AuthSuccess>;
