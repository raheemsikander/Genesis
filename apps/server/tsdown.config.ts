import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/async-tasks/worker.ts"],
	format: "esm",
	outDir: "./dist",
	clean: true,
	noExternal: [/@repo\/.*/],
});
