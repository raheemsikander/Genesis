import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

import "../index.css";
import Providers from "../providers/providers";

export const metadata: Metadata = {
	title: "Genesis",
	description: "Genesis",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ClerkProvider>
			<html lang="en" suppressHydrationWarning>
				<body className="antialiased">
					<Providers>{children}</Providers>
				</body>
			</html>
		</ClerkProvider>
	);
}
