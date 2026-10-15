import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@repo/shared": resolve(currentDir, "../../packages/shared/src"),
			"@repo/orpc-contracts": resolve(
				currentDir,
				"../../packages/orpc-contracts/src",
			),
			"@repo/ui": resolve(currentDir, "../../packages/ui/src"),
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
		passWithNoTests: false,
		setupFiles: ["./tests/helpers/setup.test-helper.ts"],
		coverage: {
			provider: "v8",
			reportsDirectory: "./coverage",
			reporter: ["text", "json-summary", "lcov"],
			include: ["src/**/*.{ts,tsx}"],
			exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
			thresholds: {
				statements: 23,
				branches: 19,
				functions: 15,
				lines: 22,
			},
		},
	},
});
