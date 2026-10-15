import { Resend } from "resend";
import { env } from "../utils/env";

let _client: Resend | null = null;

export function getResendClient(): Resend {
	if (!env.RESEND_API_KEY) {
		throw new Error(
			"Email sending is not configured. Set RESEND_API_KEY to enable.",
		);
	}
	if (!_client) {
		_client = new Resend(env.RESEND_API_KEY);
	}
	return _client;
}
