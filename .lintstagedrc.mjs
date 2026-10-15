const BIOME_IGNORED_DIRS = [
	"/.claude/",
	"/.vscode/",
	"/.next/",
	"/dist/",
	"/.turbo/",
	"/.nx/",
	"/dev-dist/",
	"/.zed/",
	"/routeTree.gen.ts",
	"/src-tauri/",
	"/.nuxt/",
	"/.expo/",
	"/.wrangler/",
	"/.alchemy/",
	"/.svelte-kit/",
	"/.source/",
	"/convex/_generated/",
	"/packages/ui/src/components/",
];

const isBiomeIgnored = (file) =>
	BIOME_IGNORED_DIRS.some((dir) => file.includes(dir));

export default {
	"*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}": (files) => {
		const filtered = files.filter((f) => !isBiomeIgnored(f));
		if (filtered.length === 0) return [];
		return [`biome check --write ${filtered.join(" ")}`];
	},
};
