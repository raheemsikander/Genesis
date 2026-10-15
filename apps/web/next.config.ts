import "./src/utils/env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	productionBrowserSourceMaps: process.env.GENERATE_SOURCEMAPS === "true",
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "img.clerk.com",
			},
		],
	},
	env: {
		NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "development",
	},
};

export default nextConfig;
