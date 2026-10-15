import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import { emailHandlers } from "./email.test-handler";
import { resetUserMocks, userHandlers } from "./user.test-handler";

const testRouter = {
	user: userHandlers,
	email: emailHandlers,
};

const client = createRouterClient(testRouter);

export const orpc = createTanstackQueryUtils(client);

export function resetOrpcMocks() {
	resetUserMocks();
}
