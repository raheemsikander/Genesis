import * as React from "react";

export const MOBILE_BREAKPOINT = 768;

// Initialize as `undefined` so the server-rendered HTML and the first client
// render agree (both treat the user as desktop) — reading `window.innerWidth`
// synchronously would diverge from SSR and trigger a React 19 hydration
// mismatch on real mobile devices. The effect populates the real value after
// hydration; consumers should treat `undefined` as desktop and accept a
// one-frame flash on mobile loads.
export function useIsMobile(): boolean | undefined {
	const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
		undefined,
	);

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const onChange = () => setIsMobile(mql.matches);
		mql.addEventListener("change", onChange);
		onChange();
		return () => mql.removeEventListener("change", onChange);
	}, []);

	return isMobile;
}
