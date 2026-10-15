"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
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
	const [isPermanentlyExpanded, setIsPermanentlyExpanded] = useState(true);

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
