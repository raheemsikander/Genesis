/**
 * UTM query params are only present on the landing URL. App Router navigations are client-side,
 * so without persistence every event after the first would lose its campaign attribution.
 */
const STORAGE_KEY = "ga_campaign";

/** GA4's native campaign dimensions, so no custom dimension registration is needed. */
export const UTM_PARAM_TO_GA_PARAM = {
	utm_id: "campaign_id",
	utm_source: "campaign_source",
	utm_medium: "campaign_medium",
	utm_campaign: "campaign_name",
	utm_term: "campaign_term",
	utm_content: "campaign_content",
} as const;

/**
 * Click IDs GA4 resolves attribution from itself, given them in `page_location`. Google Ads
 * sends gbraid/wbraid instead of gclid on iOS and under restricted consent; Display sends dclid.
 */
const CLICK_ID_PARAMS = ["gclid", "gbraid", "wbraid", "dclid"];

type GaCampaignParam =
	(typeof UTM_PARAM_TO_GA_PARAM)[keyof typeof UTM_PARAM_TO_GA_PARAM];

export type CampaignParams = Partial<Record<GaCampaignParam, string>>;

/** Every campaign key, so a narrowed campaign clears the ones it no longer carries. */
export type CampaignTagState = Record<GaCampaignParam, string | null>;

export function isAttributionParam(key: string): boolean {
	return key.startsWith("utm_") || CLICK_ID_PARAMS.includes(key);
}

// Mirrors the stored campaign so attribution survives a sessionStorage that refuses reads or writes.
let memoryCampaign: CampaignParams | null = null;

export function readCampaignParams(search: string): CampaignParams {
	const params = new URLSearchParams(search);
	const campaign: CampaignParams = {};

	const entries = Object.entries(UTM_PARAM_TO_GA_PARAM) as [
		string,
		GaCampaignParam,
	][];
	for (const [utmParam, gaParam] of entries) {
		const value = params.get(utmParam);
		if (value) {
			campaign[gaParam] = value;
		}
	}

	return campaign;
}

/**
 * Last-non-direct-touch attribution: a query string carrying UTM params replaces the stored
 * campaign, one without them resolves to whatever the session already had.
 */
export function resolveCampaignParams(search: string): CampaignParams {
	const campaign = readCampaignParams(search);
	if (Object.keys(campaign).length > 0) {
		storeCampaign(campaign);
		return campaign;
	}

	// A click ID is a non-direct touch of its own, which GA4 resolves out of `page_location`.
	// Reasserting an earlier campaign on top of it would attribute a paid click to whatever
	// newsletter the visitor arrived from an hour ago. Stored as an empty campaign rather than
	// removed, so the mirror still shadows the old value if the write is refused.
	if (CLICK_ID_PARAMS.some((key) => new URLSearchParams(search).get(key))) {
		storeCampaign({});
		return {};
	}

	return readStoredCampaign();
}

/**
 * gtag's `set` merges rather than replaces, so the campaign params it carries have to name
 * every key: a campaign that narrows from source+medium to source alone would otherwise leave
 * the old medium pinned to the tag for the rest of the document's life.
 */
export function resolveCampaignTagState(search: string): CampaignTagState {
	const campaign = resolveCampaignParams(search);
	const state = {} as CampaignTagState;

	for (const gaParam of Object.values(UTM_PARAM_TO_GA_PARAM)) {
		state[gaParam] = campaign[gaParam] ?? null;
	}

	return state;
}

function readStoredCampaign(): CampaignParams {
	if (memoryCampaign) {
		return memoryCampaign;
	}

	try {
		const stored = window.sessionStorage.getItem(STORAGE_KEY);
		if (!stored) return {};

		// Mirror it, so a sessionStorage that starts refusing reads part-way through the
		// session cannot drop attribution this page already resolved once.
		memoryCampaign = JSON.parse(stored) as CampaignParams;
		return memoryCampaign;
	} catch {
		return {};
	}
}

function storeCampaign(campaign: CampaignParams): void {
	memoryCampaign = campaign;

	try {
		window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
	} catch {
		// Storage is unavailable (private mode, disabled cookies, quota) or we are not in a
		// browser at all. The in-memory mirror above keeps this page's attribution intact.
	}
}
