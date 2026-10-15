import Rollbar from "rollbar";
import { env } from "./env";

export const rollbar = new Rollbar({
	accessToken: env.ROLLBAR_SERVER_TOKEN ?? "",
	environment: env.NODE_ENV,
	enabled: !!env.ROLLBAR_SERVER_TOKEN,
	codeVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? "development",
	captureUncaught: true,
	captureUnhandledRejections: true,
	// An exception nobody caught leaves the process in an undefined state, so it
	// pages rather than joining the same triage queue as a failed request.
	uncaughtErrorLevel: "critical",
	/**
	 * Installing a listener suppresses Node's default print-and-exit, so without
	 * this the process would page and then keep serving corrupted state. Rollbar
	 * drains its queue before exiting. Unhandled rejections have no equivalent
	 * option and are handled in `installFatalHandlers`.
	 */
	exitOnUncaughtException: true,
});
