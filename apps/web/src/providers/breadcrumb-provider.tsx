"use client";

import { usePathname } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type BreadcrumbLabels = Record<string, string>;

type BreadcrumbContextValue = {
	labels: BreadcrumbLabels;
	/**
	 * Set or clear a label override for a route's cumulative pathname.
	 * - `label` defined → upserts the override.
	 * - `label === undefined` → clears the override, optionally only when the
	 *   current value matches `expectedPrev` (used by useSetBreadcrumbLabel's
	 *   effect cleanup to avoid wiping a later writer's value).
	 */
	setLabel: (
		path: string,
		label: string | undefined,
		expectedPrev?: string,
	) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
	const [labels, setLabels] = useState<BreadcrumbLabels>({});

	const setLabel = useCallback(
		(path: string, label: string | undefined, expectedPrev?: string) => {
			setLabels((prev) => {
				if (label === undefined) {
					if (!(path in prev)) return prev;
					if (expectedPrev !== undefined && prev[path] !== expectedPrev) {
						return prev;
					}
					const next = { ...prev };
					delete next[path];
					return next;
				}
				if (prev[path] === label) return prev;
				return { ...prev, [path]: label };
			});
		},
		[],
	);

	const value = useMemo(() => ({ labels, setLabel }), [labels, setLabel]);

	return (
		<BreadcrumbContext.Provider value={value}>
			{children}
		</BreadcrumbContext.Provider>
	);
}

const EMPTY_LABELS: BreadcrumbLabels = Object.freeze({});

/**
 * Read the current label overrides. Returns an empty record when called
 * outside a BreadcrumbProvider — this lets AppBreadcrumb render fall back
 * to static labels in contexts (e.g., unit tests of unrelated portal
 * pages) where the provider isn't mounted.
 */
export function useBreadcrumbLabels(): BreadcrumbLabels {
	const ctx = useContext(BreadcrumbContext);
	return ctx?.labels ?? EMPTY_LABELS;
}

let hasWarnedMissingProvider = false;

/**
 * Register a label override for the current route. Pass `undefined` for
 * the label while data is still loading; the override is reactive, so
 * transitioning defined → undefined (e.g. cache invalidation, optimistic
 * rollback) clears any previously-set label rather than leaving a stale
 * value in the map. The override is also cleared automatically on unmount.
 *
 * The override is keyed by the current pathname (resolved via
 * `usePathname`), so two routes that happen to share a segment value
 * (e.g. /portal/users/profile vs /portal/admin/profile) can't collide.
 *
 * No-ops when called outside a BreadcrumbProvider, matching
 * useBreadcrumbLabels's read-side fallback. In development, emits a
 * one-time console.warn so the missing provider is still visible.
 */
export function useSetBreadcrumbLabel(label: string | undefined): void {
	const ctx = useContext(BreadcrumbContext);
	const pathname = usePathname();
	// Destructure setLabel so the effect depends on the stable callback
	// (useCallback with []) rather than the context value, whose reference
	// changes on every label write and would loop the effect.
	const setLabel = ctx?.setLabel;

	useEffect(() => {
		if (setLabel === undefined) {
			if (process.env.NODE_ENV !== "production" && !hasWarnedMissingProvider) {
				hasWarnedMissingProvider = true;
				console.warn(
					"useSetBreadcrumbLabel called outside a BreadcrumbProvider — label override ignored.",
				);
			}
			return;
		}
		if (!pathname) return;
		if (label === undefined) {
			// Defined → undefined transition while mounted (e.g. refetch,
			// optimistic rollback): clear any previously-set override so the
			// breadcrumb doesn't display a stale label.
			setLabel(pathname, undefined);
			return;
		}
		setLabel(pathname, label);
		// Only clear if our value is still the active one — prevents an
		// unmounting component from wiping a later writer's label.
		return () => {
			setLabel(pathname, undefined, label);
		};
	}, [setLabel, pathname, label]);
}
