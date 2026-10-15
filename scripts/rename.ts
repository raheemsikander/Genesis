#!/usr/bin/env zx
/**
 * rename.ts
 *
 * One-shot rename for MVPs forking Genesis. Replaces `genesis` placeholders
 * with the MVP's project name across config files and deployment/local/
 * staging setup docs.
 *
 * Usage:
 *   pnpm rename <name>          # lowercase letters + digits, 3–20 chars
 *   pnpm rename <name> --yes    # skip the confirmation prompt
 *
 * Safe to re-run with the same target name. If a previous run failed
 * partway through (crash, power loss, Ctrl-C after some files were written),
 * re-running finishes the remaining files — the script looks at actual
 * file contents, not just package.json's state.
 *
 * Refuses to run on a dirty working tree. Refuses to run if the repo has
 * already been renamed to a *different* name.
 */

import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	note,
	outro,
	text,
} from "@clack/prompts";
import { $, argv, chalk, fs, glob } from "zx";
import {
	applyFileChanges,
	buildBrandChanges,
	type Change,
	capitalizeSlug,
	isValidNotionUrl,
	isValidSlug,
	resolveDisplayName,
	SLUG_MAX_LENGTH,
	SLUG_MIN_LENGTH,
	SLUG_PATTERN,
	validateDisplayName,
} from "./lib/brand.ts";

$.verbose = false;

type FileReport = { path: string; occurrences: number };

const DOC_GLOBS = ["docs/setup/**/*.md", "docs/engineering/**/*.md"];

const autoYes = Boolean(argv.yes || argv.y);
const positionalName: string | undefined = argv._[0];

const die = (message: string, hint?: string): never => {
	log.error(message);
	if (hint) log.message(chalk.dim(`→ ${hint}`));
	outro(chalk.red("Failed."));
	process.exit(1);
};

function validateName(name: string): void {
	if (!SLUG_PATTERN.test(name)) {
		die(
			`"${name}" is not a valid project name.`,
			"Lowercase letters and digits only, starting with a letter. No hyphens, underscores, or uppercase. Examples: acme, myapp, proj2",
		);
	}
	if (!isValidSlug(name)) {
		die(
			`Name must be ${SLUG_MIN_LENGTH}–${SLUG_MAX_LENGTH} characters (got ${name.length}).`,
		);
	}
	if (name === "genesis") {
		die('"genesis" is the current name — nothing to rename.');
	}
}

function readCurrentName(): string {
	const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
		name: string;
	};
	return pkg.name;
}

// - "fresh": package.json is still "genesis" — a first run.
// - "resume": package.json is already the target name — prior run wrote some
//   files before failing; re-run to finish. The dirty working tree is
//   expected in this mode, so the clean-git check is skipped.
// Any other state (already renamed to something else) is blocked with a
// pointer to `git checkout .`.
type RenameState = "fresh" | "resume";

// intro() is always called before this function, so use log/outro only.
function checkRenameState(targetName: string): RenameState {
	const current = readCurrentName();
	if (current === "genesis") return "fresh";
	if (current === targetName) return "resume";
	log.warn(`This repo has already been renamed to "${current}".`);
	log.message(
		chalk.dim(
			`→ To rename to "${targetName}" instead, reset with 'git checkout .' ` +
				"(or reset the package.json name field) and re-run.",
		),
	);
	outro(chalk.yellow("No changes made."));
	process.exit(0);
}

// Best-effort detection of the GitHub repo URL from the local git remote.
// Used as the default value for the repo_url prompt — operator can override.
async function detectRepoUrl(): Promise<string> {
	const result = (await $`git remote get-url origin`.nothrow()).stdout.trim();
	if (!result) return "";
	// Convert ssh form (git@github.com:owner/repo.git) to https form so it
	// matches the `https://github.com/<owner>/<repo>` shape Terraform expects.
	return result
		.replace(/^git@github\.com:/, "https://github.com/")
		.replace(/\.git$/, "");
}

async function checkGitClean(): Promise<void> {
	const status = (await $`git status --porcelain`.nothrow()).stdout.trim();
	if (status !== "") {
		die(
			"Git working tree is not clean.",
			"Commit or stash your changes first so you can roll back if the rename goes wrong.",
		);
	}
}

async function buildDocChanges(name: string): Promise<Change[]> {
	// zx's glob is globby-backed; it returns files only by default.
	const files = (await Promise.all(DOC_GLOBS.map((g) => glob(g)))).flat();
	return files.flatMap((path) => [
		{ path, search: /\bgenesis-/g, replace: `${name}-` },
		{ path, search: /\bgenesis_/g, replace: `${name}_` },
	]);
}

function groupByPath(changes: Change[]): Map<string, Change[]> {
	const byPath = new Map<string, Change[]>();
	for (const change of changes) {
		const list = byPath.get(change.path) ?? [];
		list.push(change);
		byPath.set(change.path, list);
	}
	return byPath;
}

function readIfExists(path: string): string | null {
	try {
		return fs.readFileSync(path, "utf8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw err;
	}
}

function collectReport(changes: Change[]): FileReport[] {
	const report: FileReport[] = [];
	for (const [path, fileChanges] of groupByPath(changes)) {
		const content = readIfExists(path);
		if (content === null) continue;
		const { occurrences } = applyFileChanges(content, fileChanges);
		if (occurrences > 0) report.push({ path, occurrences });
	}
	return report;
}

function applyChanges(changes: Change[]): number {
	let written = 0;
	for (const [path, fileChanges] of groupByPath(changes)) {
		const content = readIfExists(path);
		if (content === null) continue;
		const { modified } = applyFileChanges(content, fileChanges);
		if (modified !== content) {
			fs.writeFileSync(path, modified, "utf8");
			written++;
		}
	}
	return written;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

intro(chalk.bgCyan.black(" Rename Project "));

if (!positionalName) {
	die(
		"Missing project name.",
		"Usage: pnpm rename <name>  (lowercase letters + digits, 3–20 chars)",
	);
}
// `die` returns `never` but as a const arrow function TS doesn't always
// narrow `positionalName` through it — keep the cast to satisfy the checker.
const name = positionalName as string;
validateName(name);
const state = checkRenameState(name);

if (state === "resume") {
	log.info(
		`Resuming from a partial rename to "${name}". Clean-git check skipped.`,
	);
} else {
	await checkGitClean();
}

// GitHub repo URL — auto-detected from `git remote get-url origin`, prompt
// pre-fills with the detected value. Operator can blank it out if their git
// remote isn't set yet; re-running the script later picks it up.
const detectedRepoUrl = await detectRepoUrl();
const repoUrlInput = await text({
	message: "GitHub repo URL (leave blank to skip)",
	placeholder: "https://github.com/<owner>/<repo>",
	initialValue: detectedRepoUrl,
	validate: (v) => {
		const value = v ?? "";
		return value.length === 0 ||
			/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(value)
			? undefined
			: "must be https://github.com/<owner>/<repo>";
	},
});
if (isCancel(repoUrlInput)) {
	cancel("Cancelled. No changes made.");
	process.exit(0);
}
const repoUrl = (repoUrlInput as string).trim().replace(/\/$/, "");

// Display name — the human-facing brand used in web UI, email copy, and the
// Clerk-coupled E2E asserts. Defaults to the capitalized slug; --yes takes the
// default without prompting.
const defaultDisplayName = capitalizeSlug(name);
let displayName = defaultDisplayName;
// Notion tickets DB for apollo. Blank clears the origin board's URL so a fork
// must run cl-init rather than silently routing tickets to the origin board.
let notionDbUrl = "";

if (!autoYes) {
	const displayNameInput = await text({
		message: "Display name (human-facing brand)",
		placeholder: defaultDisplayName,
		initialValue: defaultDisplayName,
		validate: (v) => {
			try {
				validateDisplayName((v ?? "").trim() || defaultDisplayName);
				return undefined;
			} catch (err) {
				return (err as Error).message;
			}
		},
	});
	if (isCancel(displayNameInput)) {
		cancel("Cancelled. No changes made.");
		process.exit(0);
	}
	displayName = resolveDisplayName(displayNameInput as string, name);

	const notionUrlInput = await text({
		message: "Notion tickets DB URL for apollo (leave blank to clear)",
		placeholder: "https://www.notion.so/<db-id>",
		validate: (v) =>
			isValidNotionUrl(v ?? "")
				? undefined
				: "must be a notion.so / notion.site URL",
	});
	if (isCancel(notionUrlInput)) {
		cancel("Cancelled. No changes made.");
		process.exit(0);
	}
	notionDbUrl = (notionUrlInput as string).trim();
}

const changes = [
	...buildBrandChanges({ name, displayName, notionDbUrl, repoUrl }),
	...(await buildDocChanges(name)),
];
const report = collectReport(changes);

if (report.length === 0) {
	outro("No occurrences of 'genesis' found. Nothing to do.");
	process.exit(0);
}

const total = report.reduce((sum, r) => sum + r.occurrences, 0);
note(
	[
		`Target name: ${chalk.bold(name)}`,
		`Files to change: ${chalk.bold(report.length)}`,
		`Total replacements: ${chalk.bold(total)}`,
		"",
		...report
			.sort((a, b) => a.path.localeCompare(b.path))
			.map((r) => `  ${r.path} ${chalk.dim(`(${r.occurrences})`)}`),
	].join("\n"),
	"Plan",
);

if (!autoYes) {
	const ok = await confirm({
		message: `Rename genesis → ${chalk.bold(name)} across ${report.length} files?`,
	});
	if (isCancel(ok) || !ok) {
		cancel("Cancelled. No changes made.");
		process.exit(0);
	}
}

const written = applyChanges(changes);

if (!repoUrl) {
	log.info(
		`Skipped: GitHub repo URL. Re-run \`pnpm rename ${name}\` once your git remote is set; only the still-default repo_url + GITHUB_OWNER lines get rewritten.`,
	);
}

note(
	[
		`1. Review the diff: ${chalk.cyan("git diff")}`,
		`2. Commit: ${chalk.cyan(`git commit -am "chore: rename to ${name}"`)}`,
		`3. Continue with setup: ${chalk.cyan("docs/setup/LOCAL_ENV.md")}`,
		`4. Verify no brand leakage remains: ${chalk.cyan("pnpm check-brand")}`,
	].join("\n"),
	"Next steps",
);

note(
	[
		`• Rename your Clerk app to ${chalk.bold(displayName)} in the Clerk dashboard —`,
		"  the E2E sign-in asserts were rewritten to match it, and the heading",
		"  itself comes from Clerk, not the code.",
		`• Bundle id is set to ${chalk.bold(`com.${name}.mobile`)}; set your real`,
		"  reverse-DNS id (apps/mobile/app.json + the Maestro appId) before app-store",
		"  submission if you own a domain.",
		notionDbUrl
			? "• apollo tickets DB set."
			: "• apollo tickets DB left blank — run cl-init before apollo ticket workflows.",
	].join("\n"),
	"Manual steps",
);

outro(chalk.green(`Renamed genesis → ${name} across ${written} files.`));
