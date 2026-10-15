import { useQuery } from "@tanstack/react-query";
import { orpc } from "../utils/orpc";

export function useUserMe() {
	return useQuery(orpc.user.me.queryOptions());
}

export function useListUsers() {
	return useQuery(orpc.user.list.queryOptions());
}
