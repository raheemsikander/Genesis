export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			[
				"feat",
				"fix",
				"chore",
				"refactor",
				"docs",
				"ci",
				"build",
				"test",
				"perf",
				"style",
				"revert",
			],
		],
		"scope-empty": [1, "never"],
		"scope-case": [2, "always", "lower-case"],
		"subject-empty": [2, "never"],
		"subject-case": [0, "never"],
		"header-max-length": [2, "always", 100],
	},
};
