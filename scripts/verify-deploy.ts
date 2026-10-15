#!/usr/bin/env zx
/**
 * verify-deploy.ts
 *
 * Triggers a Render or Vercel deploy and polls the platform's own status API
 * until the build is live (or fails). Invoked from terraform local-exec
 * provisioners inside the render and vercel modules, so `terraform apply`
 * doesn't exit until the new build is actually serving traffic — not just
 * "something" is serving traffic (which is what hitting /health would tell
 * us, since both platforms keep the previous version up during a rolling
 * deploy).
 *
 * Usage:
 *   pnpm verify-deploy render
 *   pnpm verify-deploy vercel
 *
 * Required env vars:
 *   render:
 *     RENDER_API_KEY        inherited from the operator shell (.envrc)
 *     RENDER_SERVICE_ID     service whose deploy we want to trigger and watch
 *   vercel:
 *     VERCEL_API_TOKEN      inherited from the operator shell (.envrc)
 *     DEPLOY_HOOK_URL       sourced inside the local-exec from the 0600 file
 *                           the vercel module writes (see its main.tf)
 *     VERCEL_PROJECT_ID     project to look up the resulting deployment in
 *     VERCEL_TARGET         "production" for prod, empty otherwise
 *     VERCEL_CUSTOM_ENV_ID  custom-environment id for non-prod, empty for prod
 *     VERCEL_TEAM_ID        empty for personal accounts
 *
 * Exit codes:
 *   0 — deploy reached the terminal success state in time
 *   1 — deploy failed, timed out, or required env vars were missing
 */

import { argv, chalk } from "zx";

const POLL_INTERVAL_MS = 10_000;
const TIMEOUT_MS = 20 * 60 * 1000;

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`${name} env var is required`);
	return v;
}

function log(scope: string, msg: string): void {
	console.log(`${chalk.cyan(`[${scope}]`)} ${msg}`);
}

function elapsedSec(since: number): number {
	return Math.round((Date.now() - since) / 1000);
}

// =============================================================================
// Render
// =============================================================================

const RENDER_TERMINAL_FAILURES = new Set([
	"build_failed",
	"update_failed",
	"canceled",
	"pre_deploy_failed",
]);

async function renderRequest<T>(
	path: string,
	init: RequestInit & { parseBody?: boolean } = {},
): Promise<T> {
	const apiKey = requireEnv("RENDER_API_KEY");
	const { parseBody = true, ...fetchInit } = init;
	const url = `https://api.render.com${path}`;
	let res: Response;
	try {
		res = await fetch(url, {
			...fetchInit,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				Accept: "application/json",
				...(fetchInit.headers ?? {}),
			},
		});
	} catch (err) {
		throw new Error(
			`Render API ${fetchInit.method ?? "GET"} ${url} network error`,
			{ cause: err },
		);
	}
	if (!res.ok) {
		throw new Error(
			`Render API ${path} returned HTTP ${res.status}: ${await res.text()}`,
		);
	}
	if (!parseBody) return undefined as T;
	return res.json() as Promise<T>;
}

type RenderDeploy = { id: string; status: string; createdAt: string };

// Render's POST /v1/services/{id}/deploys sometimes returns 2xx with an empty
// body (e.g. when queueing behind an in-progress deploy on a fresh service).
// We don't rely on the POST response — we trigger, then list deploys and pick
// the newest one created after our wall-clock trigger time. 5s of slack covers
// clock skew.
async function findRenderDeploy(
	serviceId: string,
	triggeredAt: number,
): Promise<RenderDeploy> {
	const findStarted = Date.now();
	while (Date.now() - findStarted < 60_000) {
		const list = await renderRequest<Array<{ deploy: RenderDeploy }>>(
			`/v1/services/${serviceId}/deploys?limit=5`,
		);
		const matches = list
			.map((wrap) => wrap.deploy)
			.filter((d) => new Date(d.createdAt).getTime() >= triggeredAt - 5_000);
		const latest = matches.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)[0];
		if (latest) return latest;
		await new Promise((r) => setTimeout(r, 3_000));
	}
	throw new Error(
		"Could not locate a Render deploy created after the trigger — check the dashboard.",
	);
}

async function runRender(): Promise<void> {
	const serviceId = requireEnv("RENDER_SERVICE_ID");
	log("render", `triggering deploy for service ${serviceId}`);

	const triggeredAt = Date.now();
	// Discard the response — its body may be empty. The deploy still gets
	// created; we locate it via the list endpoint below.
	await renderRequest<unknown>(`/v1/services/${serviceId}/deploys`, {
		method: "POST",
		parseBody: false,
	});

	const deploy = await findRenderDeploy(serviceId, triggeredAt);
	log("render", `tracking deploy ${deploy.id} (status: ${deploy.status})`);

	const started = Date.now();
	while (Date.now() - started < TIMEOUT_MS) {
		const cur = await renderRequest<RenderDeploy>(
			`/v1/services/${serviceId}/deploys/${deploy.id}`,
		);
		const elapsed = elapsedSec(started);
		if (cur.status === "live") {
			log("render", chalk.green(`deploy ${deploy.id} live (${elapsed}s)`));
			return;
		}
		if (RENDER_TERMINAL_FAILURES.has(cur.status)) {
			throw new Error(
				`Render deploy ${deploy.id} failed with status: ${cur.status}`,
			);
		}
		log("render", `deploy ${deploy.id} status: ${cur.status} (${elapsed}s)`);
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}
	throw new Error(
		`Render deploy ${deploy.id} did not become live within ${TIMEOUT_MS / 60_000}m`,
	);
}

// =============================================================================
// Vercel
// =============================================================================

const VERCEL_TERMINAL_FAILURES = new Set(["ERROR", "CANCELED"]);

async function vercelRequest<T>(
	path: string,
	query: Record<string, string> = {},
): Promise<T> {
	const token = requireEnv("VERCEL_API_TOKEN");
	const teamId = process.env.VERCEL_TEAM_ID;
	if (teamId) query.teamId = teamId;
	const qs = new URLSearchParams(query).toString();
	const url = `https://api.vercel.com${path}${qs ? `?${qs}` : ""}`;
	let res: Response;
	try {
		res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			},
		});
	} catch (err) {
		throw new Error(`Vercel API GET ${url} network error`, { cause: err });
	}
	if (!res.ok) {
		throw new Error(
			`Vercel API ${path} returned HTTP ${res.status}: ${await res.text()}`,
		);
	}
	return res.json() as Promise<T>;
}

type VercelDeployment = {
	// /v6/deployments returns `uid`; /v13/deployments/{id} returns `id`. Both
	// hold the same value (dpl_…). Read either, log whichever we have.
	id?: string;
	uid?: string;
	url: string;
	created?: number;
	readyState: string;
	target?: string | null;
	customEnvironment?: { id?: string } | null;
};

// The deploy-hook response only contains a `job` object, not the resulting
// deployment id. We trigger the hook, record the wall-clock time, then poll
// the project's deployments list for the first one created after that mark
// matching our target/custom-env. 60s of slack absorbs clock skew between the
// operator machine and Vercel's API.
async function findNewDeployment(
	triggeredAt: number,
): Promise<VercelDeployment> {
	const projectId = requireEnv("VERCEL_PROJECT_ID");
	const target = process.env.VERCEL_TARGET ?? "";
	const customEnvId = process.env.VERCEL_CUSTOM_ENV_ID ?? "";

	const findLatest = async (): Promise<VercelDeployment | null> => {
		// limit=10 is enough: this runs immediately after a Terraform-triggered
		// deploy hook, so our deployment is at the head of the list. Even if a
		// concurrent CI run fires its own deploy in the same window, the
		// target/customEnvironment filter below disambiguates by env scope.
		const body = await vercelRequest<{ deployments: VercelDeployment[] }>(
			"/v6/deployments",
			{ projectId, limit: "10" },
		);
		const matches = body.deployments
			.filter((d) => d.created >= triggeredAt - 60_000)
			.filter((d) =>
				target
					? d.target === target
					: customEnvId
						? d.customEnvironment?.id === customEnvId
						: true,
			);
		return matches.sort((a, b) => b.created - a.created)[0] ?? null;
	};

	const findStarted = Date.now();
	while (Date.now() - findStarted < 60_000) {
		const d = await findLatest();
		if (d) return d;
		await new Promise((r) => setTimeout(r, 3_000));
	}
	throw new Error(
		"Could not locate a Vercel deployment created after the trigger — check the dashboard.",
	);
}

async function runVercel(): Promise<void> {
	const hookUrl = requireEnv("DEPLOY_HOOK_URL");
	log("vercel", "triggering deploy hook");

	const triggeredAt = Date.now();
	let hookRes: Response;
	try {
		hookRes = await fetch(hookUrl, { method: "POST" });
	} catch (err) {
		throw new Error("Vercel deploy hook POST network error", { cause: err });
	}
	if (!hookRes.ok) {
		throw new Error(`Vercel deploy hook returned HTTP ${hookRes.status}`);
	}
	log("vercel", "deploy hook accepted, locating deployment");

	const deployment = await findNewDeployment(triggeredAt);
	const deployId = deployment.uid ?? deployment.id;
	if (!deployId) {
		throw new Error("Vercel deployment record had no id/uid");
	}
	log("vercel", `tracking deployment ${deployId} (${deployment.url})`);

	const started = Date.now();
	while (Date.now() - started < TIMEOUT_MS) {
		const cur = await vercelRequest<VercelDeployment>(
			`/v13/deployments/${deployId}`,
		);
		const elapsed = elapsedSec(started);
		if (cur.readyState === "READY") {
			log("vercel", chalk.green(`deployment ${deployId} ready (${elapsed}s)`));
			return;
		}
		if (VERCEL_TERMINAL_FAILURES.has(cur.readyState)) {
			throw new Error(
				`Vercel deployment ${deployId} failed with state: ${cur.readyState}`,
			);
		}
		log(
			"vercel",
			`deployment ${deployId} state: ${cur.readyState} (${elapsed}s)`,
		);
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}
	throw new Error(
		`Vercel deployment did not reach READY within ${TIMEOUT_MS / 60_000}m`,
	);
}

// =============================================================================
// Entry
// =============================================================================

const platform = argv._[0];

try {
	if (platform === "render") {
		await runRender();
	} else if (platform === "vercel") {
		await runVercel();
	} else {
		throw new Error("Usage: pnpm verify-deploy <render|vercel>");
	}
} catch (err) {
	let cur: unknown = err;
	while (cur) {
		console.error(chalk.red(cur instanceof Error ? cur.message : String(cur)));
		cur = cur instanceof Error ? cur.cause : undefined;
	}
	process.exit(1);
}
