#!/usr/bin/env zx
// Provisions a GitHub deployment environment: creates it (idempotent) and sets
// the required secrets. Run after the env's Render + Vercel resources exist.
//
// Usage: pnpm provision:github-env <env-name>
// Example: pnpm provision:github-env staging
//
// Prerequisites:
//   1. `gh` CLI installed (brew install gh / see cli.github.com for others)
//   2. `gh auth login` (one-time browser OAuth)
//   3. Run from the repo root

import "zx/globals";
import {
	cancel,
	intro,
	isCancel,
	log,
	outro,
	password,
	spinner,
} from "@clack/prompts";

$.verbose = false;

const envName = argv._[0];
if (!envName) {
	console.error("Usage: pnpm provision:github-env <env-name>");
	process.exit(1);
}

intro(chalk.bgCyan.black(` Provision GitHub env · ${envName} `));

if (!(await which("gh", { nothrow: true }))) {
	log.error("`gh` CLI not found");
	log.message(chalk.gray("macOS:   brew install gh"));
	log.message(
		chalk.gray(
			"Linux:   https://github.com/cli/cli/blob/trunk/docs/install_linux.md",
		),
	);
	log.message(chalk.gray("Windows: winget install GitHub.cli"));
	outro(chalk.red("Aborted."));
	process.exit(1);
}

try {
	await $`gh auth status`;
} catch {
	log.error("`gh` is not authenticated");
	log.message(chalk.gray("Run this first (opens a browser):  gh auth login"));
	outro(chalk.red("Aborted."));
	process.exit(1);
}

const repo = (
	await $`gh repo view --json nameWithOwner -q .nameWithOwner`
).stdout.trim();
log.info(`Repo: ${chalk.bold(repo)}`);

const envSpin = spinner();
envSpin.start(`Creating/updating environment '${envName}'`);
await $`gh api --method PUT repos/${repo}/environments/${envName} --silent`;
envSpin.stop(`Environment '${envName}' ready`);

const secrets = [
	{
		name: "DATABASE_URL",
		required: true,
		hint: "Render → postgres → Connections → External Database URL (?sslmode=require)",
	},
	{
		name: "RENDER_API_DEPLOY_HOOK",
		required: true,
		hint: "Render → API service → Settings → Deploy Hook",
	},
	{
		name: "RENDER_WORKER_DEPLOY_HOOK",
		required: false,
		hint: "Render → worker service → Settings → Deploy Hook (skip if worker disabled)",
	},
	{
		name: "VERCEL_DEPLOY_HOOK",
		required: true,
		hint: "Vercel → Project → Settings → Git → Deploy Hooks",
	},
];

const results = [];
for (const { name, required, hint } of secrets) {
	const tag = required ? chalk.red("(required)") : chalk.gray("(optional)");
	log.message(`${chalk.bold(name)} ${tag}\n${chalk.gray(hint)}`);
	const value = await password({
		message: "Value (hidden)",
		validate: (v) => (required && !v ? `${name} is required` : undefined),
	});
	if (isCancel(value)) {
		cancel("Operation cancelled");
		process.exit(0);
	}
	if (!value) {
		log.message(chalk.gray("skipped"));
		results.push({ name, status: "skipped" });
		continue;
	}
	await $`gh secret set ${name} --env ${envName} --repo ${repo} --body ${value}`;
	log.success(`${name} set`);
	results.push({ name, status: "set" });
}

const summary = results
	.map(
		(r) =>
			`  ${r.status === "set" ? chalk.green("✓") : chalk.gray("·")} ${r.name}: ${r.status}`,
	)
	.join("\n");
log.message(`${chalk.bold("Summary")}\n${summary}`);

outro(chalk.green(`GitHub environment '${envName}' provisioned.`));
