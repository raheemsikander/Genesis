#!/usr/bin/env zx
/**
 * configure-repository.ts
 *
 * One-shot GitHub repo configuration for Genesis-based projects. Idempotent.
 *
 * Usage:
 *   pnpm configure-repo                       # current repo (inferred via gh)
 *   pnpm configure-repo owner/repo-name       # explicit repo
 *   pnpm configure-repo --yes                 # skip the confirmation prompt
 *
 * Requirements: gh CLI authenticated, admin access on the target repo.
 */

import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	note,
	outro,
	spinner,
} from "@clack/prompts";
import { $, argv, chalk } from "zx";

$.verbose = false;

type ApiArg = string | number;

const autoYes = Boolean(argv.yes || argv.y);
const explicitRepo = argv._[0] as string | undefined;

let REPO = "";

const die = (message: string, hint?: string): never => {
	log.error(message);
	if (hint) log.message(chalk.dim(`→ ${hint}`));
	outro(chalk.red("Failed."));
	process.exit(1);
};

const mapApiError = (description: string, output: string): never => {
	const text = output.trim();
	if (text) log.message(chalk.dim(text));

	if (/HTTP 401|Bad credentials/i.test(text)) {
		return die(
			"Not authenticated to GitHub.",
			"Run 'gh auth login' (or 'gh auth refresh -s admin:org,repo') and re-run.",
		);
	}
	if (/HTTP 403|Resource not accessible|Must have admin/i.test(text)) {
		return die(
			`Your GitHub user does not have admin access on ${REPO}.`,
			"Ask an org/repo admin to run this script, or have them grant you admin.",
		);
	}
	if (/HTTP 404/i.test(text)) {
		return die(
			`GitHub returned 404 while: ${description} (on ${REPO}).`,
			"Check the 'owner/repo' spelling. If the repo is correct, the feature may not be available on this plan (rulesets require GitHub Free public, Pro, Team, or Enterprise).",
		);
	}
	if (/rate limit|HTTP 429/i.test(text)) {
		return die(
			`GitHub API rate limit hit while: ${description}.`,
			"Wait a few minutes and re-run. The script is idempotent.",
		);
	}
	if (/HTTP 5\d\d/.test(text)) {
		return die(
			`GitHub returned a server error while: ${description}.`,
			"Retry in a minute. If it persists, check https://www.githubstatus.com/.",
		);
	}
	return die(
		`Failed to ${description}.`,
		"See the 'gh' output above for details.",
	);
};

const ghApi = async (
	description: string,
	args: ApiArg[],
	input?: string,
): Promise<string> => {
	const runner = input === undefined ? $ : $({ input });
	const result = await runner`gh api ${args}`.nothrow();
	if (result.exitCode !== 0) {
		mapApiError(description, String(result.stderr || result.stdout || ""));
	}
	return result.stdout;
};

const resourceExists = async (
	description: string,
	path: string,
): Promise<boolean> => {
	const result = await $`gh api ${path}`.nothrow();
	if (result.exitCode === 0) return true;
	const text = String(result.stderr || result.stdout || "");
	if (/HTTP 404|Not Found/i.test(text)) return false;
	mapApiError(description, text);
	return false;
};

const preflight = async (): Promise<void> => {
	const ghInstalled = await $`command -v gh`.nothrow();
	if (ghInstalled.exitCode !== 0) {
		die(
			"GitHub CLI ('gh') is not installed.",
			"Install it from https://cli.github.com/ and re-run.",
		);
	}
	const authStatus = await $`gh auth status`.nothrow();
	if (authStatus.exitCode !== 0) {
		die("GitHub CLI is not authenticated.", "Run 'gh auth login' and re-run.");
	}

	if (explicitRepo) {
		REPO = explicitRepo;
	} else {
		const current =
			await $`gh repo view --json nameWithOwner -q .nameWithOwner`.nothrow();
		if (current.exitCode !== 0 || !current.stdout.trim()) {
			die(
				"No repo specified and the current directory is not a GitHub repo.",
				"Usage: pnpm configure-repo [owner/repo]",
			);
		}
		REPO = current.stdout.trim();
	}

	const perms = (
		await ghApi("check repo permissions", [
			`/repos/${REPO}`,
			"--jq",
			".permissions.admin // false",
		])
	).trim();
	if (perms !== "true") {
		die(
			`Your GitHub user does not have admin access on ${REPO}.`,
			"Admin is required to change repo settings, rulesets, and security features.",
		);
	}
};

const setMergeSettings = async (): Promise<void> => {
	await ghApi("update repo settings", [
		"--method",
		"PATCH",
		`/repos/${REPO}`,
		"--field",
		"allow_squash_merge=true",
		"--field",
		"allow_merge_commit=true",
		"--field",
		"allow_rebase_merge=false",
		"--field",
		"allow_auto_merge=true",
		"--field",
		"delete_branch_on_merge=true",
		"--field",
		"squash_merge_commit_title=PR_TITLE",
		"--field",
		"squash_merge_commit_message=BLANK",
	]);
};

const ensureBranch = async (branch: string): Promise<"existed" | "created"> => {
	if (
		await resourceExists(
			`branch '${branch}'`,
			`/repos/${REPO}/branches/${branch}`,
		)
	) {
		return "existed";
	}

	const defaultBranch = (
		await ghApi("read repo metadata", [
			`/repos/${REPO}`,
			"--jq",
			".default_branch",
		])
	).trim();
	if (!defaultBranch || defaultBranch === "null") {
		die(
			`Repo '${REPO}' has no default branch.`,
			"Push an initial commit to the repo before running this script.",
		);
	}

	const defaultSha = (
		await ghApi("read default branch ref", [
			`/repos/${REPO}/git/refs/heads/${defaultBranch}`,
			"--jq",
			".object.sha",
		])
	).trim();

	await ghApi(`create branch '${branch}'`, [
		"--method",
		"POST",
		`/repos/${REPO}/git/refs`,
		"--field",
		`ref=refs/heads/${branch}`,
		"--field",
		`sha=${defaultSha}`,
	]);
	return "created";
};

const requiredStatusChecks = [
	{ context: "build" },
	{ context: "lint" },
	{ context: "check-title" },
	{ context: "Web Unit Tests" },
	{ context: "Server Unit & Integration Tests" },
];

const buildRuleset = (branch: "develop" | "main") => ({
	name: branch,
	target: "branch" as const,
	enforcement: "active" as const,
	conditions: { ref_name: { include: [`refs/heads/${branch}`], exclude: [] } },
	rules: [
		{
			type: "required_status_checks",
			parameters: {
				strict_required_status_checks_policy: true,
				required_status_checks: requiredStatusChecks,
			},
		},
		{
			type: "pull_request",
			parameters: {
				required_approving_review_count: 1,
				dismiss_stale_reviews_on_push: branch === "develop",
				require_code_owner_review: false,
				require_last_push_approval: false,
				required_review_thread_resolution: branch === "develop",
				required_reviewers: [],
				allowed_merge_methods: branch === "develop" ? ["squash"] : ["merge"],
			},
		},
		{ type: "non_fast_forward" },
		{ type: "deletion" },
	],
});

const upsertRuleset = async (
	name: string,
	payload: object,
): Promise<"created" | "updated"> => {
	const id = (
		await ghApi("list rulesets", [
			`/repos/${REPO}/rulesets`,
			"--jq",
			`.[] | select(.name == "${name}") | .id`,
		])
	).trim();

	const body = JSON.stringify(payload);
	if (id) {
		await ghApi(
			`update ruleset '${name}'`,
			["--method", "PUT", `/repos/${REPO}/rulesets/${id}`, "--input", "-"],
			body,
		);
		return "updated";
	}
	await ghApi(
		`create ruleset '${name}'`,
		["--method", "POST", `/repos/${REPO}/rulesets`, "--input", "-"],
		body,
	);
	return "created";
};

const enableDependabot = async (): Promise<void> => {
	await ghApi("enable vulnerability alerts", [
		"--method",
		"PUT",
		`/repos/${REPO}/vulnerability-alerts`,
	]);
	await ghApi("enable automated security fixes", [
		"--method",
		"PUT",
		`/repos/${REPO}/automated-security-fixes`,
	]);
};

const runStep = async <T>(
	label: string,
	done: (result: T) => string,
	fn: () => Promise<T>,
): Promise<T> => {
	const s = spinner();
	s.start(label);
	try {
		const result = await fn();
		s.stop(`${chalk.green("✓")} ${done(result)}`);
		return result;
	} catch (err) {
		s.stop(`${chalk.red("✗")} ${label}`);
		throw err;
	}
};

// ─── Main ─────────────────────────────────────────────────────────────────────

intro(chalk.bgCyan.black(" Configure Repository "));

await runStep(
	"Checking gh CLI, auth, and admin access",
	() => `Ready as admin on ${chalk.bold(REPO)}`,
	preflight,
);

note(
	[
		`Repo: ${chalk.bold(REPO)}`,
		"",
		"This will:",
		"  1. Apply merge settings (squash + merge commits, auto-merge, delete branch on merge)",
		"  2. Ensure 'develop' and 'main' branches exist",
		"  3. Upsert branch rulesets for 'develop' and 'main'",
		"  4. Enable Dependabot vulnerability alerts and security fixes",
	].join("\n"),
	"Plan",
);

if (!autoYes) {
	const ok = await confirm({ message: "Proceed?" });
	if (isCancel(ok) || !ok) {
		cancel("Cancelled. No changes made.");
		process.exit(0);
	}
}

await runStep(
	"[1/4] Applying merge settings",
	() => "Merge settings applied",
	setMergeSettings,
);

await runStep(
	"[2/4] Ensuring 'main' and 'develop' branches exist",
	(r) => `main: ${r.main}, develop: ${r.develop}`,
	async () => ({
		main: await ensureBranch("main"),
		develop: await ensureBranch("develop"),
	}),
);

await runStep(
	"[3/4] Upserting branch rulesets",
	(r) => `develop: ${r.develop}, main: ${r.main}`,
	async () => ({
		develop: await upsertRuleset("develop", buildRuleset("develop")),
		main: await upsertRuleset("main", buildRuleset("main")),
	}),
);

await runStep(
	"[4/4] Enabling Dependabot alerts + automated fixes",
	() => "Dependabot enabled",
	enableDependabot,
);

outro(chalk.green(`Done. ${REPO} is configured.`));
