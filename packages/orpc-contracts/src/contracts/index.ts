import { authContract } from "./auth.contract";
import { emailContract } from "./email.contract";
import { storageContract } from "./storage.contract";
import { transcriptionContract } from "./transcription.contract";
import { userContract } from "./user.contract";

export const appContract = {
	auth: authContract,
	email: emailContract,
	storage: storageContract,
	transcription: transcriptionContract,
	user: userContract,
};
