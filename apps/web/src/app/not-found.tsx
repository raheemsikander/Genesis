import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function NotFound() {
	const { userId } = await auth();
	if (userId) {
		redirect("/portal");
	}
	redirect("/");
}
