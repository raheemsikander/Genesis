import { authContract } from "./auth.contract";
import { emailContract } from "./email.contract";
import { storageContract } from "./storage.contract";
import { userContract } from "./user.contract";

export const appContract = {
	auth: authContract,
	email: emailContract,
	storage: storageContract,
	user: userContract,
};
