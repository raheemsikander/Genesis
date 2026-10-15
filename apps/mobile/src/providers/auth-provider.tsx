import { type ReactNode, useMemo } from "react";
import { useUserMe } from "../api/user.api";
import { AuthContext } from "../hooks/use-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
	const query = useUserMe();
	const value = useMemo(
		() => ({
			user: query.data,
			isLoading: query.isPending,
			isError: query.isError,
			refetch: () => query.refetch(),
		}),
		[query.data, query.isPending, query.isError, query.refetch],
	);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
