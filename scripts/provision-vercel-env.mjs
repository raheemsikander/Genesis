#!/usr/bin/env zx
// Provisions a Vercel environment: creates the project if missing, ensures the
// target environment exists (custom env for non-prod), disables deployment
// protection, upserts env vars, assigns a .vercel.app domain, creates the
// deploy hook, and triggers the first deployment via that hook. Prints the
// hook URL at the end — save it; you'll feed it into the GitHub env
// provisioner as VERCEL_DEPLOY_HOOK.
//
// Note: the deploy-hook creation endpoint (POST /v2/projects/{id}/deploy-hooks)
// is undocumented but used by the official `vercel` CLI — same endpoint
// `vercel deploy-hooks create` hits.
//
// Usage: pnpm provision:vercel-env <env-name> [--project <name>] [--team <teamId>] [--branch <branch>]
// Example: pnpm provision:vercel-env staging --project genesis
//
// The script only assigns `.vercel.app` subdomains — custom domains are
// rejected with a pointer to docs/setup/integrations/CUSTOM_DOMAIN.md, which
// walks through adding a custom domain later (DNS + running `pnpm update:cors`
// once DNS propagates).
//
// Prerequisites:
//   1. `pnpm dlx vercel login` (browser OAuth) — or set VERCEL_TOKEN env var
//   2. Vercel GitHub App installed on your org (one-time, dashboard-only)
//   3. `gh` CLI installed (used to read the GitHub repo owner/name when
//      creating a new Vercel project linked to this repo)

import "zx/globals";
import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import {
	cancel,
	intro,
	isCancel,
	log,
	note,
	outro,
	password,
	select,
	spinner,
	text,
} from "@clack/prompts";

$.verbose = false;

const API = "https://api.vercel.com";

const envName = argv._[0];
if (!envName) {
	console.error(
		"Usage: pnpm provision:vercel-env <env-name> [--project name] [--team id] [--branch name]",
	);
	process.exit(1);
}
const isProduction = envName === "production";

intro(chalk.bgCyan.black(` Provision Vercel env · ${envName} `));

if (!(await which("gh", { nothrow: true }))) {
	log.error("`gh` CLI not found (used to look up the GitHub repo to link)");
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

const token = await loadToken();

// TDZ-safe two-step: declare first (so withTeam can read it), then assign
// after any interactive prompt resolves.
let teamId = argv.team || process.env.VERCEL_TEAM_ID || null;
if (!teamId) {
	teamId = await pickOwner();
}
const ownerSlug = await resolveOwnerSlug();

let projectName = argv.project;
if (!projectName) {
	projectName = (
		await ask(
			text({
				message: "Vercel project name",
				validate: (v) => (v.trim() ? undefined : "Required"),
			}),
		)
	).trim();
}
const branch = argv.branch || defaultBranchFor(envName);

const ownerDisplay = ownerSlug
	? teamId
		? `${ownerSlug} (team)`
		: `${ownerSlug} (personal)`
	: "unknown";
note(
	[
		`Owner       ${ownerDisplay}`,
		`Project     ${projectName}`,
		`Environment ${envName}`,
		`Branch      ${branch}`,
	].join("\n"),
	"Summary",
);

const project = await withSpinner("Resolving Vercel project", () =>
	ensureProject(projectName),
);
log.success(`Project ready (id: ${project.id})`);

let customEnvId = null;
if (!isProduction) {
	customEnvId = await withSpinner(
		`Ensuring custom environment '${envName}'`,
		() => ensureCustomEnv(project.id, envName, branch),
	);
	log.success(`Custom environment ready (id: ${customEnvId})`);

	await withSpinner("Disabling deployment protection", () =>
		disableProtection(project.id),
	);
	log.success("Deployment protection disabled");
}

await upsertEnvVars(project.id, envName, customEnvId);

const domain = await promptDomain(project.id, customEnvId);

const hookUrl = await deployHookFlow(project, envName, branch);
await triggerDeployment(hookUrl);

const outroLines = [
	chalk.green(`Vercel environment '${envName}' provisioned.`),
];
if (domain) {
	outroLines.push(
		chalk.gray(`Will serve at https://${domain} once the deployment finishes.`),
	);
}
outro(outroLines.join("\n"));

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function ask(promise) {
	const value = await promise;
	if (isCancel(value)) {
		cancel("Operation cancelled");
		process.exit(0);
	}
	return value;
}

async function withSpinner(label, fn) {
	const s = spinner();
	s.start(label);
	try {
		const result = await fn();
		s.stop(label);
		return result;
	} catch (e) {
		s.stop(chalk.red(`${label} failed`));
		throw e;
	}
}

async function loadToken() {
	if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;

	const paths = [];
	if (platform() === "darwin") {
		paths.push(
			join(
				homedir(),
				"Library",
				"Application Support",
				"com.vercel.cli",
				"auth.json",
			),
		);
	}
	paths.push(join(homedir(), ".local", "share", "com.vercel.cli", "auth.json"));

	for (const p of paths) {
		if (!existsSync(p)) continue;
		try {
			const { token } = JSON.parse(readFileSync(p, "utf8"));
			if (token) return token;
		} catch {
			// fall through
		}
	}

	log.error("No Vercel auth found.");
	log.message(chalk.gray("Run this first:  pnpm dlx vercel login"));
	log.message(chalk.gray("Or set VERCEL_TOKEN in your env for CI."));
	outro(chalk.red("Aborted."));
	process.exit(1);
}

function withTeam(path) {
	if (!teamId) return path;
	const sep = path.includes("?") ? "&" : "?";
	return `${path}${sep}teamId=${teamId}`;
}

async function api(method, path, body) {
	const res = await fetch(`${API}${withTeam(path)}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const txt = await res.text();
		const err = new Error(`${method} ${path} → ${res.status}: ${txt}`);
		err.status = res.status;
		err.body = txt;
		throw err;
	}
	if (res.status === 204) return null;
	return res.json();
}

async function pickOwner() {
	let teams = [];
	try {
		const data = await api("GET", "/v2/teams");
		teams = data?.teams ?? [];
	} catch (e) {
		log.warn(`Couldn't list Vercel teams: ${e.message}`);
	}

	const options = [
		{ value: null, label: "Personal account" },
		...teams.map((t) => ({ value: t.id, label: t.slug, hint: t.name })),
		{
			value: "__manual__",
			label: "Other…",
			hint: "paste a team_... id",
		},
	];

	const choice = await ask(
		select({
			message: "Where should this Vercel project live?",
			options,
		}),
	);
	if (choice !== "__manual__") return choice;

	const manual = await ask(
		text({
			message: "Paste team id (starts with team_)",
			validate: (v) =>
				v.startsWith("team_") ? undefined : "Expected team_...",
		}),
	);
	return manual.trim();
}

async function resolveOwnerSlug() {
	if (teamId) {
		try {
			const team = await api("GET", `/v2/teams/${teamId}`);
			return team?.slug ?? null;
		} catch {
			return null;
		}
	}
	try {
		const data = await api("GET", "/v2/user");
		return data?.user?.username ?? null;
	} catch {
		return null;
	}
}

function dashboardUrl(pathSuffix = "") {
	if (!ownerSlug) return "https://vercel.com/dashboard";
	return `https://vercel.com/${ownerSlug}/${projectName}${pathSuffix}`;
}

function defaultBranchFor(env) {
	if (env === "production") return "main";
	if (env === "staging") return "develop";
	return env;
}

async function ensureProject(name) {
	try {
		return await api("GET", `/v9/projects/${name}`);
	} catch (e) {
		if (e.status !== 404) throw e;
	}
	const repo = (
		await $`gh repo view --json nameWithOwner -q .nameWithOwner`
	).stdout.trim();
	log.info(`Project '${name}' not found — creating and linking to ${repo}`);
	return await api("POST", "/v11/projects", {
		name,
		framework: "nextjs",
		rootDirectory: "apps/web",
		installCommand: "pnpm install --frozen-lockfile",
		gitRepository: { type: "github", repo },
	});
}

async function ensureCustomEnv(projectId, slug, envBranch) {
	const { environments = [] } = await api(
		"GET",
		`/v9/projects/${projectId}/custom-environments`,
	);
	const existing = environments.find((e) => e.slug === slug);
	if (existing) return existing.id;
	const created = await api(
		"POST",
		`/v9/projects/${projectId}/custom-environments`,
		{
			slug,
			branchMatcher: { type: "equals", pattern: envBranch },
		},
	);
	return created.id;
}

async function disableProtection(projectId) {
	await api("PATCH", `/v9/projects/${projectId}`, { ssoProtection: null });
}

async function upsertEnvVars(projectId, envSlug, customEnvIdForVars) {
	const variables = [
		{
			key: "NEXT_PUBLIC_SERVER_URL",
			required: true,
			secret: false,
			hint: "Render API URL for this env (e.g. https://genesis-api-staging.onrender.com)",
		},
		{
			key: "NEXT_PUBLIC_NODE_ENV",
			required: true,
			autoValue: envSlug,
			hint: "matches the environment name",
		},
		{
			key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
			required: true,
			secret: false,
			hint: "Clerk Dashboard → API Keys (pk_test_... or pk_live_...)",
		},
		{
			key: "CLERK_SECRET_KEY",
			required: true,
			secret: true,
			hint: "Clerk Dashboard → API Keys (sk_test_... or sk_live_...)",
		},
		{
			key: "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
			required: true,
			autoValue: "/sign-in",
			hint: "project default",
		},
		{
			key: "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
			required: true,
			autoValue: "/sign-up",
			hint: "project default",
		},
		{
			key: "NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN",
			required: false,
			secret: true,
			hint: "Rollbar post_client_item token (enter to skip)",
		},
		{
			key: "ROLLBAR_CLIENT_SOURCEMAP_TOKEN",
			required: false,
			secret: true,
			hint: "Rollbar post_server_item token for source maps (enter to skip)",
		},
		{
			key: "DEPLOY_URL",
			required: false,
			secret: false,
			hint: "Deployed site URL, no trailing slash (enter to skip — set after domain)",
		},
	];

	const base = customEnvIdForVars
		? { customEnvironmentIds: [customEnvIdForVars] }
		: { target: ["production"] };

	log.step(chalk.bold("Env vars"));
	const payload = [];
	const skipped = [];
	for (const v of variables) {
		if (v.autoValue !== undefined) {
			log.message(
				`${chalk.green("•")} ${v.key} ${chalk.gray(`= ${v.autoValue}`)} ${chalk.gray(`(${v.hint})`)}`,
			);
			payload.push({
				key: v.key,
				value: v.autoValue,
				type: "encrypted",
				...base,
			});
			continue;
		}
		const tag = v.required ? chalk.red("(required)") : chalk.gray("(optional)");
		log.message(`${chalk.bold(v.key)} ${tag}\n${chalk.gray(v.hint)}`);
		const prompt = v.secret ? password : text;
		const value = await ask(
			prompt({
				message: v.secret ? "Value (hidden)" : "Value",
				validate: (val) =>
					v.required && !val ? `${v.key} is required` : undefined,
			}),
		);
		const trimmed = String(value).trim();
		if (!trimmed) {
			skipped.push(v.key);
			continue;
		}
		payload.push({ key: v.key, value: trimmed, type: "encrypted", ...base });
	}

	const s = spinner();
	s.start(`Upserting ${payload.length} env var(s)`);
	const result = await api(
		"POST",
		`/v10/projects/${projectId}/env?upsert=true`,
		payload,
	);
	const created = result?.created?.length ?? 0;
	const failed = result?.failed ?? [];
	s.stop(`${created} env var(s) set`);
	if (skipped.length > 0) {
		log.message(chalk.gray(`skipped: ${skipped.join(", ")}`));
	}
	if (failed.length > 0) {
		log.error(`${failed.length} env var(s) failed:`);
		for (const f of failed) {
			log.message(
				chalk.red(
					`  - ${f.error?.envVarKey ?? "?"}: ${f.error?.message ?? "unknown"}`,
				),
			);
		}
	}
}

async function promptDomain(projectId, customEnvIdForDomain) {
	const suggestion = `${projectName}-${envName}.vercel.app`;
	log.step(chalk.bold("Domain"));
	if (isProduction) {
		log.message(
			chalk.gray(
				"Vercel auto-assigns a .vercel.app URL to Production. Enter a specific",
			),
		);
		log.message(chalk.gray("subdomain now, or skip to use the default."));
	} else {
		log.message(
			chalk.gray("Required for non-production envs — no stable URL otherwise."),
		);
	}
	log.message(
		chalk.gray(
			"Only .vercel.app subdomains are handled here (custom domains: follow docs/setup/integrations/CUSTOM_DOMAIN.md).",
		),
	);

	while (true) {
		const input = await ask(
			text({
				message: isProduction
					? "Domain (empty to skip)"
					: `Domain (e.g. ${suggestion})`,
				validate: (v) => {
					const trimmed = v.trim();
					if (!trimmed) {
						return isProduction
							? undefined
							: "Required for non-production envs";
					}
					if (!trimmed.endsWith(".vercel.app")) {
						return "Only .vercel.app subdomains accepted — see CUSTOM_DOMAIN.md";
					}
					return undefined;
				},
			}),
		);
		const trimmed = input.trim();
		if (!trimmed) return "";

		const s = spinner();
		s.start(`Assigning ${trimmed}`);
		const result = await assignDomain(projectId, trimmed, customEnvIdForDomain);
		if (result.assigned) {
			s.stop(`Domain ${trimmed} assigned`);
			return trimmed;
		}
		s.stop(chalk.yellow(`'${trimmed}' is taken elsewhere`));
		log.warn(
			`'${trimmed}' is already taken by another Vercel account or project — pick a different one.`,
		);
	}
}

async function assignDomain(projectId, name, customEnvIdForDomain) {
	const body = customEnvIdForDomain
		? { name, customEnvironmentId: customEnvIdForDomain }
		: { name };
	try {
		await api("POST", `/v10/projects/${projectId}/domains`, body);
		return { assigned: true };
	} catch (e) {
		if (e.status !== 409) throw e;
		// 409 can mean:
		//   (a) already assigned to THIS project → GET returns the record
		//   (b) taken by another Vercel account/project → GET returns 404
		try {
			await api("GET", `/v9/projects/${projectId}/domains/${name}`);
			return { assigned: true };
		} catch (inner) {
			if (inner.status === 404) return { assigned: false };
			throw inner;
		}
	}
}

async function ensureDeployHook(projectId, name, ref) {
	const project = await api("GET", `/v9/projects/${projectId}`);
	const existing = project?.link?.deployHooks?.find((h) => h.name === name);
	if (existing?.url) return { url: existing.url, reused: true };

	const updated = await api("POST", `/v2/projects/${projectId}/deploy-hooks`, {
		name,
		ref,
	});
	const hook = updated?.link?.deployHooks?.find((h) => h.name === name);
	if (!hook?.url) {
		throw new Error("Deploy hook created but URL missing from response");
	}
	return { url: hook.url, reused: false };
}

async function deployHookFlow(project, envSlug, hookBranch) {
	const s = spinner();
	s.start(`Ensuring deploy hook '${envSlug}' → '${hookBranch}'`);
	const { url, reused } = await ensureDeployHook(
		project.id,
		envSlug,
		hookBranch,
	);
	s.stop(
		`Deploy hook ${reused ? "already exists" : "created"} (${envSlug} → ${hookBranch})`,
	);
	note(
		`VERCEL_DEPLOY_HOOK = ${url}\n\nSave this — you'll paste it when running\npnpm provision:github-env.`,
		"Copy this",
	);
	return url;
}

async function triggerDeployment(hookUrl) {
	const s = spinner();
	s.start("Triggering first deployment");
	try {
		const res = await fetch(hookUrl, { method: "POST" });
		if (!res.ok) {
			const txt = await res.text();
			s.stop(chalk.yellow("Couldn't trigger deploy"));
			log.warn(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
			log.message(chalk.gray(`Trigger manually: curl -X POST "${hookUrl}"`));
			return;
		}
		const data = await res.json().catch(() => ({}));
		const jobId = data?.job?.id;
		s.stop(`Deployment triggered${jobId ? ` (job ${jobId})` : ""}`);
		log.message(chalk.gray(`Watch: ${dashboardUrl("/deployments")}`));
	} catch (e) {
		s.stop(chalk.yellow("Couldn't trigger deploy"));
		log.warn(e.message);
		log.message(chalk.gray(`Trigger manually: curl -X POST "${hookUrl}"`));
	}
}
