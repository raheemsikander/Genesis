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
} from "@clack/prompts";
import { $, argv, chalk, fs, glob } from "zx";

$.verbose = false;

type Change = { path: string; search: RegExp; replace: string };
type FileReport = { path: string; occurrences: number };

const NAME_PATTERN = /^[a-z][a-z0-9]*$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;
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
	if (!NAME_PATTERN.test(name)) {
		die(
			`"${name}" is not a valid project name.`,
			"Lowercase letters and digits only, starting with a letter. No hyphens, underscores, or uppercase. Examples: acme, myapp, proj2",
		);
	}
	if (name.length < MIN_LENGTH || name.length > MAX_LENGTH) {
		die(
			`Name must be ${MIN_LENGTH}–${MAX_LENGTH} characters (got ${name.length}).`,
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

async function checkGitClean(): Promise<void> {
	const status = (await $`git status --porcelain`.nothrow()).stdout.trim();
	if (status !== "") {
		die(
			"Git working tree is not clean.",
			"Commit or stash your changes first so you can roll back if the rename goes wrong.",
		);
	}
}

function buildAllowlistChanges(name: string): Change[] {
	return [
		{
			path: "package.json",
			search: /"name":\s*"genesis"/g,
			replace: `"name": "${name}"`,
		},

		{
			path: "docker-compose.yml",
			search: /(\bPOSTGRES_(?:USER|PASSWORD|DB):\s*)genesis\b/g,
			replace: `$1${name}`,
		},
		{
			path: "docker-compose.yml",
			search: /(\bMINIO_ROOT_USER:\s*)genesis\b/g,
			replace: `$1${name}`,
		},
		{
			path: "docker-compose.yml",
			search: /(\bMINIO_ROOT_PASSWORD:\s*)genesis(\d+)/g,
			replace: `$1${name}$2`,
		},
		{
			path: "docker-compose.yml",
			search: /pg_isready -U genesis -d genesis/g,
			replace: `pg_isready -U ${name} -d ${name}`,
		},
		{
			path: "docker-compose.yml",
			search: /postgresql:\/\/genesis:genesis@localhost:5433\/genesis/g,
			replace: `postgresql://${name}:${name}@localhost:5433/${name}`,
		},
		{
			path: "docker-compose.yml",
			search: /username: genesis, password: genesis123/g,
			replace: `username: ${name}, password: ${name}123`,
		},

		{
			path: "docker-compose.test.yml",
			search: /\bgenesis-test-(db|minio)\b/g,
			replace: `${name}-test-$1`,
		},
		{
			path: "docker-compose.test.yml",
			search: /\bgenesis_test\b/g,
			replace: `${name}_test`,
		},

		{ path: "render.yaml", search: /\bgenesis-/g, replace: `${name}-` },
		{
			path: "render.yaml",
			// Matches `name: genesis`, `- name: genesis` (list item), and
			// `#  name: genesis` (commented-out prod block) for `name`,
			// `databaseName`, and `user`.
			search: /(^\s*(?:[#-]\s*)?(?:name|databaseName|user):\s*)genesis\b/gm,
			replace: `$1${name}`,
		},

		// Order matters: `genesis_test` and `genesis123` first because \bgenesis\b doesn't cross word chars.
		{
			path: "apps/server/.env.example",
			search: /\bgenesis_test\b/g,
			replace: `${name}_test`,
		},
		{
			path: "apps/server/.env.example",
			search: /\bgenesis(\d+)/g,
			replace: `${name}$1`,
		},
		{ path: "apps/server/.env.example", search: /\bgenesis\b/g, replace: name },

		{
			path: "apps/web/.env.example",
			search: /@genesis\.com\b/g,
			replace: `@${name}.com`,
		},

		{
			path: ".github/workflows/server-tests.yml",
			search: /\bgenesis_test\b/g,
			replace: `${name}_test`,
		},
	];
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

// Apply each regex to a shrinking buffer so later regexes can't re-count
// matches that earlier ones have already rewritten. This fixes the
// double-count that happened when multiple regexes targeted the same
// occurrence in render.yaml (`\bgenesis-` + the `name:/databaseName:/user:`
// rule both matched `name: genesis-api-staging`).
function applyFileChanges(
	content: string,
	fileChanges: Change[],
): { modified: string; occurrences: number } {
	let modified = content;
	let occurrences = 0;
	for (const change of fileChanges) {
		const matches = modified.match(change.search);
		if (matches && matches.length > 0) {
			occurrences += matches.length;
			modified = modified.replace(change.search, change.replace);
		}
	}
	return { modified, occurrences };
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

const changes = [
	...buildAllowlistChanges(name),
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

note(
	[
		`1. Review the diff: ${chalk.cyan("git diff")}`,
		`2. Commit: ${chalk.cyan(`git commit -am "chore: rename to ${name}"`)}`,
		`3. Continue with setup: ${chalk.cyan("docs/setup/LOCAL_ENV.md")}`,
	].join("\n"),
	"Next steps",
);

outro(chalk.green(`Renamed genesis → ${name} across ${written} files.`));
