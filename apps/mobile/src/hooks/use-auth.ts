import type { UserSchema } from "@repo/shared";
import { createContext, useContext } from "react";

export type AuthContextValue = {
	user: UserSchema | undefined;
	isLoading: boolean;
	isError: boolean;
	refetch: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useDbUser(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useDbUser must be used within AuthProvider");
	}
	return ctx;
}
