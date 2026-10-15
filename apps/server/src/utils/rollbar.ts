import Rollbar from "rollbar";
import { env } from "./env";

export const rollbar = new Rollbar({
	accessToken: env.ROLLBAR_SERVER_TOKEN ?? "",
	environment: env.NODE_ENV,
	enabled: !!env.ROLLBAR_SERVER_TOKEN,
	codeVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? "development",
	captureUncaught: true,
	captureUnhandledRejections: true,
});
