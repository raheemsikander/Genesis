"use client";

import type { UserRole } from "@repo/shared";
import { createContext, useContext } from "react";

export interface AuthContextValue {
	user: AuthUser | null;
	isLoading: boolean;
	isError: boolean;
	/** The query error when isError is true. Lets consumers distinguish 401 from 5xx. */
	error: Error | null;
	refetch: () => Promise<unknown>;
}

export interface AuthUser {
	uuid: string;
	name: string;
	email: string;
	role: UserRole;
	imageUrl: string | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Returns the cached DB user from the nearest <AuthProvider>.
 * Throws if used outside the provider.
 */
export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within <AuthProvider>");
	}
	return ctx;
}
