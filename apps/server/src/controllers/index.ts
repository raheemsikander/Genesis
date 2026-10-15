import { authController } from "./auth/auth.controller";
import { emailController } from "./email/email.controller";
import { storageController } from "./storage/storage.controller";
import { transcriptionController } from "./transcription/transcription.controller";
import { userController } from "./user/user.controller";

export const appRouter = {
	auth: authController,
	email: emailController,
	storage: storageController,
	transcription: transcriptionController,
	user: userController,
};
