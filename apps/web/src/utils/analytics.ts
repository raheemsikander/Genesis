import mixpanel, { type Mixpanel } from "mixpanel-browser";
import { env } from "./env";
import { rollbar } from "./rollbar";

type EventProperties = Record<string, string | number | boolean | undefined>;

export const AnalyticsEvent = {
	SIGN_IN: "Sign In",
	SIGN_UP: "Sign Up",
	SIGN_OUT: "Sign Out",
} as const;

export type AnalyticsEventName =
	(typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

class AnalyticsService {
	private mixpanel: Mixpanel | null = null;

	init(): void {
		const token = env.NEXT_PUBLIC_MIXPANEL_TOKEN;
		if (!token || this.mixpanel) return;
		try {
			mixpanel.init(token, {
				debug: env.NEXT_PUBLIC_NODE_ENV === "development",
				track_pageview: "url-with-path-and-query-string",
				persistence: "localStorage",
				// sendBeacon survives window.location.href hard navigations
				// (sign-in/sign-up finalize, auth-error sign-out) — XHR may be
				// aborted before the auth event flushes.
				api_transport: "sendBeacon",
				record_sessions_percent: 50,
				record_idle_timeout_ms: 900_000, // 15 min: split session if user idle this long
				record_max_ms: 900_000, // 15 min: cap a single recording at this length
				// Opt-in masking: input values are masked automatically; tag any DOM
				// element rendering user PII with className="mp-mask" to mask its text.
				record_mask_text_class: "mp-mask",
			});
			mixpanel.register({
				environment: env.NEXT_PUBLIC_NODE_ENV,
			});
			this.mixpanel = mixpanel;
		} catch (err) {
			rollbar.warning("Failed to initialise Mixpanel", err as Error, {
				component: "AnalyticsService",
				op: "init",
			});
			if (env.NEXT_PUBLIC_NODE_ENV === "development") {
				console.error("Failed to initialise Mixpanel:", err);
			}
		}
	}

	track(name: AnalyticsEventName, properties?: EventProperties): void {
		if (!this.mixpanel) return;
		this.mixpanel.track(name, properties);
	}

	identify(userId: string): void {
		if (!this.mixpanel) return;
		this.mixpanel.identify(userId);
	}

	setUserProperties(properties: EventProperties): void {
		if (!this.mixpanel) return;
		this.mixpanel.people.set(properties);
	}

	registerSuperProperties(properties: EventProperties): void {
		if (!this.mixpanel) return;
		this.mixpanel.register(properties);
	}

	reset(): void {
		if (!this.mixpanel) return;
		this.mixpanel.reset();
	}
}

export const analytics = new AnalyticsService();
