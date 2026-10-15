import Rollbar from "rollbar";
import { env } from "./env";

export const rollbarConfig: Rollbar.Configuration = {
	accessToken: env.NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN ?? "",
	environment: env.NEXT_PUBLIC_NODE_ENV,
	enabled: !!env.NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN,
	captureUncaught: true,
	captureUnhandledRejections: true,
	payload: {
		client: {
			javascript: {
				source_map_enabled: true,
				code_version: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "development",
			},
		},
	},
};

// Singleton for non-React code (e.g. orpc.ts).
// The @rollbar/react Provider creates its own instance from rollbarConfig
// because it crashes during Next.js static page generation with a pre-created instance.
export const rollbar = new Rollbar(rollbarConfig);
