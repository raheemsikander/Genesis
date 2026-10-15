import { env } from "./env";
import {
	isAttributionParam,
	resolveCampaignParams,
	resolveCampaignTagState,
} from "./utm";

const GTAG_SCRIPT_URL = "https://www.googletagmanager.com/gtag/js";
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

export type GaEventParams = Record<
	string,
	string | number | boolean | undefined
>;

type Gtag = (...args: unknown[]) => void;

type GtagWindow = Window & {
	dataLayer?: unknown[];
	gtag?: Gtag;
};

type PageIdentity = {
	page_location: string;
	page_referrer: string;
};

/**
 * GA4 resolves a session's traffic source from `page_location`, so the attribution params have
 * to survive the scrub. Everything else goes: this app's URLs carry an invitee's email, a live
 * single-use Clerk invitation ticket and post-sign-in redirect targets.
 */
function campaignQuery(search: string): string {
	const kept = new URLSearchParams();
	for (const [key, value] of new URLSearchParams(search)) {
		if (isAttributionParam(key)) {
			kept.append(key, value);
		}
	}

	const query = kept.toString();
	return query ? `?${query}` : "";
}

/**
 * A non-http referrer (`android-app://`, `about:`) parses fine but has an opaque origin, which
 * serialises to the literal string "null". GA4 would pin that as a real referrer for the whole
 * session, where an empty one correctly reads as direct traffic.
 */
function scrubUrl(url: string): string {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return "";
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return "";
	}

	return `${parsed.origin}${parsed.pathname}${campaignQuery(parsed.search)}`;
}

/**
 * A value that is not a measurement ID (a GTM container, a UA property, a stream id) turns the
 * integration off rather than failing env validation. That validation also runs in the browser,
 * where a throw would white-screen every page over an optional analytics var.
 */
function measurementId(): string | null {
	const configured = env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
	return configured && MEASUREMENT_ID_PATTERN.test(configured)
		? configured
		: null;
}

export function isGoogleAnalyticsEnabled(): boolean {
	return measurementId() !== null;
}

export function googleAnalyticsScriptSrc(): string | null {
	const id = measurementId();
	return id ? `${GTAG_SCRIPT_URL}?id=${id}` : null;
}

class GoogleAnalyticsService {
	private initialised = false;
	private lastTrackedUrl: string | null = null;

	init(): void {
		this.initialisedGtag();
	}

	trackPageView(pathname: string, search: string): void {
		const gtag = this.initialisedGtag();
		if (!gtag) return;

		// The full query string decides whether this counts as a new view; only the campaign
		// allowlist survives into what is actually sent.
		const url = search ? `${pathname}?${search}` : pathname;
		if (url === this.lastTrackedUrl) return;
		this.lastTrackedUrl = url;

		const identity = this.pageIdentity({ pathname, search });
		/**
		 * Both halves of this belong on the tag rather than on one event. Enhanced Measurement
		 * hits (scroll, form_start, user_engagement) are built inside gtag.js and would
		 * otherwise read the raw document URL. And GA4 only reads `campaign_*` at tag scope:
		 * passed as event params they arrive as unregistered custom params instead.
		 */
		gtag("set", { ...identity, ...resolveCampaignTagState(search) });

		gtag("event", "page_view", identity);
	}

	trackEvent(name: string, params: GaEventParams = {}): void {
		const gtag = this.initialisedGtag();
		if (!gtag) return;

		gtag("event", name, params);
	}

	setUserId(userId: string | null): void {
		const gtag = this.initialisedGtag();
		if (!gtag) return;

		gtag("set", { user_id: userId });
	}

	/**
	 * Every entry point goes through here because React runs child effects before parent ones:
	 * the pageview tracker would otherwise queue an event before the provider's init(), and GA4
	 * drops an event that has no config ahead of it.
	 */
	private initialisedGtag(): Gtag | null {
		const id = measurementId();
		const gtag = this.gtag();
		if (!gtag || !id) return null;
		if (this.initialised) return gtag;

		this.initialised = true;
		gtag("js", new Date());
		gtag("config", id, {
			// App Router navigations never reload the document, so gtag.js would only ever
			// report the landing page. Pageviews are sent explicitly instead.
			send_page_view: false,
			...this.pageIdentity(),
			...resolveCampaignParams(window.location.search),
		});

		return gtag;
	}

	/**
	 * `document.referrer` is the landing URL of the previous page in full, so on an internal
	 * navigation out of /verify-email or /sign-up it carries the same secrets the location does.
	 */
	private pageIdentity(route?: {
		pathname: string;
		search: string;
	}): PageIdentity {
		const location = route
			? `${window.location.origin}${route.pathname}${campaignQuery(route.search)}`
			: scrubUrl(window.location.href);

		return {
			page_location: location,
			page_referrer: scrubUrl(document.referrer),
		};
	}

	private gtag(): Gtag | null {
		if (typeof window === "undefined" || !isGoogleAnalyticsEnabled()) {
			return null;
		}

		const gtagWindow = window as GtagWindow;
		gtagWindow.dataLayer ??= [];
		gtagWindow.gtag ??= function gtag() {
			// gtag.js reads the raw `arguments` object off the queue. Spreading it into an
			// array is not equivalent and the tag silently drops the command.
			// biome-ignore lint/complexity/noArguments: required by the gtag.js queue contract
			gtagWindow.dataLayer?.push(arguments);
		};

		return gtagWindow.gtag;
	}
}

export const googleAnalytics = new GoogleAnalyticsService();
