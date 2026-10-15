import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: isCI ? 1 : undefined,
	reporter: isCI ? "list" : "html",
	expect: {
		timeout: 10_000,
	},
	use: {
		baseURL: "http://localhost:3001",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "global setup",
			testMatch: "**/setup.e2e.ts",
		},
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
			dependencies: ["global setup"],
		},
	],
	webServer: [
		{
			command: isCI ? "node apps/server/dist/index.mjs" : "pnpm dev:server",
			url: "http://localhost:3000/health",
			timeout: 120_000,
			reuseExistingServer: !isCI,
			cwd: "../..",
		},
		{
			command: isCI ? "pnpm --filter web start" : "pnpm dev:web",
			port: 3001,
			timeout: 120_000,
			reuseExistingServer: !isCI,
			cwd: "../..",
		},
	],
});
