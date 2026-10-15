import { implement } from "@orpc/server";
import { appContract } from "@repo/orpc-contracts";

export const emailHandlers = {
	invite: implement(appContract.email.invite).handler(() => ({
		id: "email_test_123",
	})),
};
