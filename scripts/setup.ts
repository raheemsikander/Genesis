#!/usr/bin/env zx
/**
 * setup.ts
 *
 * First-run bootstrap for a fresh clone. Idempotent.
 *
 * Usage:
 *   pnpm setup
 *
 * What it does:
 *   1. Resolves this worktree's sandbox slot (`zx scripts/sandbox.ts info`).
 *   2. Copies apps/server/.env.example -> apps/server/.env (if missing),
 *      rewriting ports for the resolved slot.
 *   3. Copies apps/web/.env.example -> apps/web/.env (if missing), same way.
 *   4. Starts local infrastructure (`pnpm infra:up`): Postgres, Redis, MinIO.
 *   5. Runs the `minio-init` one-shot container to create the `file-uploads`
 *      bucket (gated behind the `init` compose profile), via the sandbox CLI
 *      so it targets this slot's compose project.
 *   6. Runs database migrations (`pnpm db:migrate`).
 *
 * After this, the only thing left to do is fill in the Clerk keys in the
 * generated .env files, then `pnpm dev`.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { intro, log, outro, spinner } from "@clack/prompts";
import { $, chalk } from "zx";
import { applySlotPorts, portsForSlot } from "./lib/sandbox-core.ts";

$.verbose = false;

const ENV_PAIRS = [
	{ src: "apps/server/.env.example", dest: "apps/server/.env" },
	{ src: "apps/web/.env.example", dest: "apps/web/.env" },
];

async function currentSlot(): Promise<number> {
	const out = await $`zx scripts/sandbox.ts info --json`;
	return JSON.parse(out.stdout).slot as number;
}

async function ensureEnvFiles(slot: number) {
	const ports = portsForSlot(slot);
	const created: string[] = [];
	for (const { src, dest } of ENV_PAIRS) {
		if (existsSync(dest)) continue;
		if (!existsSync(src)) {
			log.warn(`Missing template ${src} — skipping ${dest}`);
			continue;
		}
		const template = await readFile(src, "utf8");
		await writeFile(dest, applySlotPorts(template, ports));
		created.push(dest);
	}
	if (created.length === 0) {
		log.info(".env files already exist — leaving them as-is");
	} else {
		log.success(`Created for sandbox slot ${slot}: ${created.join(", ")}`);
	}
	return created;
}

async function startInfra() {
	const s = spinner();
	s.start("Starting Postgres, Redis, MinIO…");
	try {
		await $`pnpm infra:up`;
		s.stop("Infrastructure ready.");
	} catch (err) {
		s.stop("Infrastructure failed to start.");
		throw err;
	}
}

async function createMinioBucket() {
	const s = spinner();
	s.start("Creating MinIO bucket…");
	try {
		await $`zx scripts/sandbox.ts infra bucket-init`;
		s.stop("MinIO bucket ready.");
	} catch (err) {
		s.stop("MinIO bucket creation failed.");
		throw err;
	}
}

async function runMigrations() {
	const s = spinner();
	s.start("Running database migrations…");
	try {
		await $`pnpm db:migrate`;
		s.stop("Migrations applied.");
	} catch (err) {
		s.stop("Migrations failed.");
		throw err;
	}
}

intro(chalk.bold("Genesis local setup"));

const slot = await currentSlot();
log.info(
	`Sandbox slot ${slot}. Run \`pnpm sandbox\` anytime to see your ports.`,
);
const createdEnvs = await ensureEnvFiles(slot);
await startInfra();
await createMinioBucket();
await runMigrations();

outro(
	createdEnvs.length > 0
		? "Done. Next: open the .env files, paste in your Clerk keys, then `pnpm dev`."
		: "Done. Run `pnpm dev` to start the app.",
);
