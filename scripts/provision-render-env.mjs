#!/usr/bin/env zx
// Provisions a Render environment after the Blueprint has been synced in the
// dashboard: pushes env-group secrets, fetches the Postgres External URL,
// runs migrations against it, triggers redeploys on the API + worker, and
// prints the DATABASE_URL + deploy-hook dashboard URLs to save for the
// GitHub env provisioner.
//
// Usage: pnpm provision:render-env <env-name> [--project <prefix>]
// Example: pnpm provision:render-env staging
//
// Prerequisites (one-time):
//   1. Render account + billing; Render GitHub App installed on the repo org
//   2. render.yaml committed; Blueprint synced in the Render dashboard
//      (this creates the services this script operates on)
//   3. A Render API key — create at:
//        https://dashboard.render.com/u/settings#api-keys
//      The script prompts for it interactively on first run. To skip the
//      prompt, `export RENDER_API_KEY=rnd_...` in your shell.
//      (Render CLI's `render login` writes an OAuth token, not an API key,
//      so we can't read that — dashboard key is the supported path.)

import "zx/globals";
import { readFileSync } from "node:fs";
import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	note,
	outro,
	password,
	spinner,
	text,
} from "@clack/prompts";

$.verbose = false;

const API = "https://api.render.com/v1";

const envName = argv._[0];
if (!envName) {
	console.error(
		"Usage: pnpm provision:render-env <env-name> [--project <prefix>]",
	);
	process.exit(1);
}

intro(chalk.bgCyan.black(` Provision Render env · ${envName} `));

let apiKey = process.env.RENDER_API_KEY;
if (!apiKey) {
	log.info("Render API key");
	log.message(
		chalk.gray(
			"Create one (one-time): https://dashboard.render.com/u/settings#api-keys",
		),
	);
	log.message(
		chalk.gray(
			"Tip: `export RENDER_API_KEY=rnd_...` to skip this prompt next time.",
		),
	);
	apiKey = await ask(
		password({
			message: "RENDER_API_KEY",
			validate: (v) => (v ? undefined : "Required"),
		}),
	);
}

const detectedPrefix = detectProjectPrefixFromYaml();
let projectPrefix = argv.project;
if (!projectPrefix) {
	projectPrefix = (
		await ask(
			text({
				message: "Project prefix (from render.yaml)",
				placeholder: detectedPrefix || "genesis",
				initialValue: detectedPrefix || "",
				validate: (v) => (v.trim() ? undefined : "Required"),
			}),
		)
	).trim();
}

const expected = {
	envGroup: `${envName}-secrets`,
	api: `${projectPrefix}-api-${envName}`,
	worker: `${projectPrefix}-worker-${envName}`,
	postgres: `${projectPrefix}-postgres-${envName}`,
};

note(
	[
		`Env group  ${expected.envGroup}`,
		`API        ${expected.api}`,
		`Worker     ${expected.worker}  (optional — skipped if absent)`,
		`Postgres   ${expected.postgres}`,
	].join("\n"),
	"Render resources",
);

const proceed = await ask(confirm({ message: "Proceed?", initialValue: true }));
if (!proceed) {
	outro(chalk.red("Aborted."));
	process.exit(0);
}

const { envGroup, apiService, workerService, postgres } = await withSpinner(
	"Resolving Render resources",
	async () => {
		const envGroup = await findEnvGroup(expected.envGroup);
		if (!envGroup)
			throw new Error(`Env group '${expected.envGroup}' not found`);
		const apiService = await findService(expected.api);
		if (!apiService) throw new Error(`Service '${expected.api}' not found`);
		const workerService = await findService(expected.worker);
		const postgres = await findPostgres(expected.postgres);
		if (!postgres) throw new Error(`Postgres '${expected.postgres}' not found`);
		return { envGroup, apiService, workerService, postgres };
	},
);

log.success(
	`Resolved: api=${apiService.id}${workerService ? `, worker=${workerService.id}` : ""}, postgres=${postgres.id}, env-group=${envGroup.id}`,
);

await pushEnvVars(envGroup.id);

const dbUrl = await withSpinner("Fetching Postgres External URL", () =>
	fetchDatabaseUrl(postgres.id),
);
log.success("Got Postgres External URL");

await runMigrations(dbUrl);

log.step(chalk.bold("Redeploys"));
await triggerDeploy(apiService);
if (workerService) await triggerDeploy(workerService);

note(
	[
		`DATABASE_URL              = ${dbUrl}`,
		`RENDER_API_DEPLOY_HOOK    — grab from ${hookDashboardUrl(apiService)}`,
		...(workerService
			? [
					`RENDER_WORKER_DEPLOY_HOOK — grab from ${hookDashboardUrl(workerService)}`,
				]
			: []),
		"",
		"Render's API doesn't expose deploy-hook URLs — open each link,",
		"Settings → Deploy Hook → Copy.",
	].join("\n"),
	"Save for `pnpm provision:github-env`",
);

outro(chalk.green(`Render environment '${envName}' provisioned.`));

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
		log.error(e.message);
		outro(chalk.red("Aborted."));
		process.exit(1);
	}
}

async function renderApi(method, path, body) {
	const res = await fetch(`${API}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const txt = await res.text();
		const err = new Error(`${method} ${path} → ${res.status}: ${txt}`);
		err.status = res.status;
		throw err;
	}
	if (res.status === 204) return null;
	const txt = await res.text();
	if (!txt) return null;
	try {
		return JSON.parse(txt);
	} catch {
		return null;
	}
}

// Render list endpoints return one of two shapes:
//   - flat array: [item, item, ...]
//   - wrapped:    [{ cursor, <resourceKey>: {...} }, ...] or { items: [...] }
function unwrapList(data, resourceKey) {
	if (!Array.isArray(data)) {
		if (Array.isArray(data?.items)) return data.items;
		return [];
	}
	return data.map((entry) => entry?.[resourceKey] ?? entry);
}

async function findEnvGroup(name) {
	const data = await renderApi(
		"GET",
		`/env-groups?name=${encodeURIComponent(name)}&limit=20`,
	);
	const items = unwrapList(data, "envGroup");
	return items.find((g) => g?.name === name) || null;
}

async function findService(name) {
	const data = await renderApi(
		"GET",
		`/services?name=${encodeURIComponent(name)}&limit=20`,
	);
	const items = unwrapList(data, "service");
	return items.find((s) => s?.name === name) || null;
}

async function findPostgres(name) {
	const data = await renderApi(
		"GET",
		`/postgres?name=${encodeURIComponent(name)}&limit=20`,
	);
	const items = unwrapList(data, "postgres");
	return items.find((p) => p?.name === name) || null;
}

async function fetchDatabaseUrl(postgresId) {
	const info = await renderApi(
		"GET",
		`/postgres/${postgresId}/connection-info`,
	);
	const raw =
		info?.externalConnectionString ||
		info?.externalConnection ||
		info?.connectionString;
	if (!raw) {
		throw new Error(
			"Postgres connection-info did not include an external URL — is the DB still provisioning?",
		);
	}
	return raw.includes("sslmode=") ? raw : `${raw}?sslmode=require`;
}

async function runMigrations(dbUrl) {
	log.step(chalk.bold("Database migrations"));
	try {
		await $({
			env: { ...process.env, DATABASE_URL: dbUrl },
			verbose: true,
		})`pnpm --filter server db:migrate`;
		log.success("Migrations applied");
	} catch {
		log.error("Migrations failed — not proceeding to redeploy.");
		log.message(
			chalk.gray(
				"Debug manually: cd apps/server && DATABASE_URL='<url>' pnpm db:migrate",
			),
		);
		outro(chalk.red("Aborted."));
		process.exit(1);
	}
}

async function triggerDeploy(service) {
	try {
		const deploy = await renderApi("POST", `/services/${service.id}/deploys`, {
			clearCache: "do_not_clear",
		});
		log.success(
			`${service.name} redeploy triggered${deploy?.id ? ` (id: ${deploy.id})` : ""}`,
		);
	} catch (e) {
		log.warn(`Couldn't trigger redeploy on ${service.name}: ${e.message}`);
		log.message(
			chalk.gray(
				`Trigger manually: Render dashboard → ${service.name} → Manual Deploy → Deploy latest commit`,
			),
		);
	}
}

function hookDashboardUrl(service) {
	const slug = service.type === "background_worker" ? "worker" : "web";
	return `https://dashboard.render.com/${slug}/${service.id}/settings#deploy-hook`;
}

function detectProjectPrefixFromYaml() {
	try {
		const content = readFileSync("render.yaml", "utf-8");
		const match = content.match(/name:\s*([a-z][a-z0-9-]*?)-api-[a-z]+/);
		return match?.[1] ?? null;
	} catch {
		return null;
	}
}

async function pushEnvVars(envGroupId) {
	const variables = [
		{
			key: "CORS_ORIGIN",
			required: true,
			secret: false,
			hint: "Full Vercel URL for this env (include https://, no trailing slash)",
		},
		{
			key: "CLERK_SECRET_KEY",
			required: true,
			secret: true,
			hint: "Clerk Dashboard → API Keys (sk_test_... or sk_live_...)",
		},
		{
			key: "CLERK_PUBLISHABLE_KEY",
			required: true,
			secret: false,
			hint: "Clerk Dashboard → API Keys (pk_test_... or pk_live_...)",
		},
		{
			key: "RESEND_API_KEY",
			required: false,
			secret: true,
			hint: "Resend Dashboard → API Keys (enter to skip if email is not used)",
		},
		{
			key: "RESEND_FROM_EMAIL",
			required: false,
			secret: false,
			hint: "Sender address verified in Resend (enter to skip)",
		},
		{
			key: "S3_ENDPOINT",
			required: false,
			secret: false,
			hint: "S3-compatible endpoint URL (R2 or other; enter to skip)",
		},
		{
			key: "S3_ACCESS_KEY_ID",
			required: false,
			secret: true,
			hint: "S3 access key id (enter to skip)",
		},
		{
			key: "S3_SECRET_ACCESS_KEY",
			required: false,
			secret: true,
			hint: "S3 secret access key (enter to skip)",
		},
		{
			key: "S3_REGION",
			required: false,
			autoValue: "auto",
			hint: "Cloudflare R2 convention",
		},
		{
			key: "S3_BUCKET",
			required: false,
			autoValue: "file-uploads",
			hint: "default bucket name",
		},
		{
			key: "ROLLBAR_SERVER_TOKEN",
			required: false,
			secret: true,
			hint: "Rollbar post_server_item token (enter to skip)",
		},
	];

	log.step(chalk.bold("Env group secrets"));
	const envVars = [];
	const skipped = [];
	for (const v of variables) {
		if (v.autoValue !== undefined) {
			log.message(
				`${chalk.green("•")} ${v.key} ${chalk.gray(`= ${v.autoValue}`)} ${chalk.gray(`(${v.hint})`)}`,
			);
			envVars.push({ key: v.key, value: v.autoValue });
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
		envVars.push({ key: v.key, value: trimmed });
	}

	// Render's API only supports per-key upserts:
	//   PUT /v1/env-groups/{id}/env-vars/{key} with body { value }
	// No bulk-replace endpoint exists. Skipped optionals are left alone
	// (not deleted), so re-runs that skip a previously-set value preserve it.
	const s = spinner();
	s.start(`Pushing ${envVars.length} env var(s)`);
	const failures = [];
	for (const { key, value } of envVars) {
		try {
			await renderApi(
				"PUT",
				`/env-groups/${envGroupId}/env-vars/${encodeURIComponent(key)}`,
				{ value },
			);
		} catch (e) {
			failures.push({ key, error: e.message });
		}
	}
	const okCount = envVars.length - failures.length;
	s.stop(`${okCount} env var(s) set`);
	if (skipped.length > 0) {
		log.message(chalk.gray(`skipped (left unchanged): ${skipped.join(", ")}`));
	}
	if (failures.length > 0) {
		log.error(`${failures.length} failed:`);
		for (const f of failures) {
			log.message(chalk.red(`  - ${f.key}: ${f.error}`));
		}
		outro(chalk.red("Aborted."));
		process.exit(1);
	}
}
