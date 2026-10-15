"use client";

import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import {
	AuthContext,
	type AuthContextValue,
	type AuthUser,
} from "../hooks/use-auth";
import { orpc } from "../utils/orpc";

/**
 * Wraps a TanStack Query call to `orpc.user.me` and exposes the cached
 * DB user via React Context. Mount inside the portal layout (after auth gate).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
	const query = useQuery(orpc.user.me.queryOptions());

	const value = useMemo<AuthContextValue>(() => {
		const user: AuthUser | null = query.data
			? {
					uuid: query.data.uuid,
					name: query.data.name,
					email: query.data.email,
					role: query.data.role,
					imageUrl: query.data.imageUrl,
				}
			: null;

		return {
			user,
			isLoading: query.isPending,
			isError: query.isError,
			error: query.error,
			refetch: async () => {
				await query.refetch();
			},
		};
	}, [query.data, query.isPending, query.isError, query.error, query.refetch]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
