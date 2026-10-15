import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@repo/shared": resolve(import.meta.dirname, "../../packages/shared/src"),
			"@repo/orpc-contracts": resolve(
				import.meta.dirname,
				"../../packages/orpc-contracts/src",
			),
		},
	},
	test: {
		watch: false,
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts"],
		exclude: ["**/*.integration.test.ts"],
		passWithNoTests: false,
		coverage: {
			provider: "v8",
			reportsDirectory: "./coverage/unit",
			reporter: ["text", "json-summary", "lcov"],
			include: ["src/**/*.{ts,tsx}"],
			exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
			thresholds: {
				statements: 34,
				branches: 45,
				functions: 24,
				lines: 33,
			},
		},
	},
});
