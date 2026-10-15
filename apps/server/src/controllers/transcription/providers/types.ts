export type ProviderResult = {
	transcript: string;
	confidence: number | null;
	durationSec: number | null;
	model: string;
};

export type ProviderFn = (file: File) => Promise<ProviderResult>;
