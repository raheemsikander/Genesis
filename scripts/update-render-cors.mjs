#!/usr/bin/env zx
// Updates CORS_ORIGIN on the Render env group for a given environment and
// triggers a redeploy on the API service so the new value takes effect.
// Run this after:
//   - `pnpm provision:vercel-env <env>` assigned a domain, OR
//   - you swapped a .vercel.app domain for a custom one (see
//     docs/setup/integrations/CUSTOM_DOMAIN.md), OR
//   - the Vercel URL changed for any other reason.
//
// Usage: pnpm update:cors <env-name> [--project <prefix>] [--value <url>]
// Example: pnpm update:cors staging --value https://my-project-staging.vercel.app
//
// Prerequisites (same as provision:render-env):
//   1. RENDER_API_KEY env var (prompted on first run if missing)
//   2. Blueprint already synced (env group + API service must exist)

import "zx/globals";
import { readFileSync } from "node:fs";
import {
	cancel,
	intro,
	isCancel,
	log,
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
		"Usage: pnpm update:cors <env-name> [--project <prefix>] [--value <url>]",
	);
	process.exit(1);
}

intro(chalk.bgCyan.black(` Update CORS_ORIGIN · ${envName} `));

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

const envGroupName = `${envName}-secrets`;
const apiServiceName = `${projectPrefix}-api-${envName}`;

const { envGroup, apiService } = await withSpinner(
	"Resolving Render resources",
	async () => {
		const envGroup = await findEnvGroup(envGroupName);
		if (!envGroup) throw new Error(`Env group '${envGroupName}' not found`);
		const apiService = await findService(apiServiceName);
		if (!apiService) throw new Error(`Service '${apiServiceName}' not found`);
		return { envGroup, apiService };
	},
);
log.success(`Resolved: env-group=${envGroup.id}, api=${apiService.id}`);

let newValue = argv.value;
if (!newValue) {
	newValue = await ask(
		text({
			message: "New CORS_ORIGIN",
			placeholder: "https://my-project-staging.vercel.app",
			validate: (v) => {
				const trimmed = v.trim();
				if (!trimmed) return "Required";
				if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://"))
					return "Must be a full URL (include https://)";
				if (trimmed.endsWith("/")) return "Remove the trailing slash";
				return undefined;
			},
		}),
	);
	newValue = newValue.trim();
}

// Re-validate in case --value was passed
if (!newValue.startsWith("https://") && !newValue.startsWith("http://")) {
	log.error(`'${newValue}' must be a full URL (include https://).`);
	outro(chalk.red("Aborted."));
	process.exit(1);
}
if (newValue.endsWith("/")) {
	log.error("Remove the trailing slash from the URL.");
	outro(chalk.red("Aborted."));
	process.exit(1);
}

await withSpinner(`Setting CORS_ORIGIN = ${newValue}`, () =>
	renderApi(
		"PUT",
		`/env-groups/${envGroup.id}/env-vars/${encodeURIComponent("CORS_ORIGIN")}`,
		{ value: newValue },
	),
);
log.success("Env group updated");

await withSpinner(`Triggering redeploy on ${apiServiceName}`, async () => {
	try {
		await renderApi("POST", `/services/${apiService.id}/deploys`, {
			clearCache: "do_not_clear",
		});
	} catch (e) {
		log.warn(`Couldn't trigger redeploy: ${e.message}`);
		log.message(
			chalk.gray(
				`Trigger manually: Render dashboard → ${apiServiceName} → Manual Deploy → Deploy latest commit`,
			),
		);
		throw e;
	}
});
log.success("Redeploy triggered");
log.message(
	chalk.gray(
		`Watch: https://dashboard.render.com/web/${apiService.id}/deploys`,
	),
);

outro(
	`${chalk.green(`CORS_ORIGIN updated for '${envName}'.`)}\n${chalk.gray("Once the redeploy shows Live, sign in on the Vercel URL to verify.")}`,
);

// ────────────────────────────────────────────────────────────────────────────
// Helpers (shared shape with provision-render-env.mjs; intentionally not DRY'd
// into a module to keep each script independently readable and runnable)
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

function detectProjectPrefixFromYaml() {
	try {
		const content = readFileSync("render.yaml", "utf-8");
		const match = content.match(/name:\s*([a-z][a-z0-9-]*?)-api-[a-z]+/);
		return match?.[1] ?? null;
	} catch {
		return null;
	}
}
