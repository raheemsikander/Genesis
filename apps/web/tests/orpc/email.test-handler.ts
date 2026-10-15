import { appContract } from "@genesis/orpc-contracts";
import { implement } from "@orpc/server";

export const emailHandlers = {
	invite: implement(appContract.email.invite).handler(() => ({
		id: "email_test_123",
	})),
};
