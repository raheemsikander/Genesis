"use client";

import { MOBILE_BREAKPOINT } from "@repo/ui/hooks/use-mobile";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

interface SidebarControlContextType {
	isPermanentlyExpanded: boolean;
	handleManualToggle: () => void;
}

const SidebarControlContext = createContext<SidebarControlContextType | null>(
	null,
);

export function SidebarControlProvider({ children }: { children: ReactNode }) {
	// Default to expanded so SSR and the first client render agree on desktop
	// markup; the matchMedia effect below collapses on mobile after hydration.
	const [isPermanentlyExpanded, setIsPermanentlyExpanded] = useState(true);

	// Snapshot the desktop expanded state at the moment of crossing into mobile
	// so mobile-side overlay toggles (which also flip isPermanentlyExpanded)
	// don't pollute the value we restore on the mobile -> desktop crossing.
	const wasMobileRef = useRef<boolean | null>(null);
	const desktopExpandedRef = useRef<boolean>(true);
	const isExpandedRef = useRef<boolean>(isPermanentlyExpanded);
	isExpandedRef.current = isPermanentlyExpanded;
	useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const sync = () => {
			const isMobile = mql.matches;
			const wasMobile = wasMobileRef.current;
			if (wasMobile !== true && isMobile) {
				desktopExpandedRef.current = isExpandedRef.current;
				setIsPermanentlyExpanded(false);
			} else if (wasMobile === true && !isMobile) {
				setIsPermanentlyExpanded(desktopExpandedRef.current);
			}
			wasMobileRef.current = isMobile;
		};
		sync();
		mql.addEventListener("change", sync);
		return () => mql.removeEventListener("change", sync);
	}, []);

	const handleManualToggle = useCallback(() => {
		setIsPermanentlyExpanded((prev) => !prev);
	}, []);

	return (
		<SidebarControlContext.Provider
			value={{ isPermanentlyExpanded, handleManualToggle }}
		>
			{children}
		</SidebarControlContext.Provider>
	);
}

export function useSidebarControl() {
	const context = useContext(SidebarControlContext);
	if (!context) {
		throw new Error(
			"useSidebarControl must be used within a SidebarControlProvider",
		);
	}
	return context;
}
