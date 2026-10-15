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
 *   1. Copies apps/server/.env.example -> apps/server/.env (if missing)
 *   2. Copies apps/web/.env.example -> apps/web/.env (if missing)
 *   3. Starts local infrastructure (`pnpm infra:up`): Postgres, Redis, MinIO.
 *   4. Runs the `minio-init` one-shot container to create the `file-uploads`
 *      bucket (gated behind the `init` compose profile).
 *   5. Runs database migrations (`pnpm db:migrate`).
 *
 * After this, the only thing left to do is fill in the Clerk keys in the
 * generated .env files, then `pnpm dev`.
 */

import { existsSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { intro, log, outro, spinner } from "@clack/prompts";
import { $, chalk } from "zx";

$.verbose = false;

const ENV_PAIRS = [
	{ src: "apps/server/.env.example", dest: "apps/server/.env" },
	{ src: "apps/web/.env.example", dest: "apps/web/.env" },
];

async function ensureEnvFiles() {
	const created: string[] = [];
	for (const { src, dest } of ENV_PAIRS) {
		if (existsSync(dest)) continue;
		if (!existsSync(src)) {
			log.warn(`Missing template ${src} — skipping ${dest}`);
			continue;
		}
		await copyFile(src, dest);
		created.push(dest);
	}
	if (created.length === 0) {
		log.info(".env files already exist — leaving them as-is");
	} else {
		log.success(`Created: ${created.join(", ")}`);
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
		await $`docker compose run --rm minio-init`;
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

const createdEnvs = await ensureEnvFiles();
await startInfra();
await createMinioBucket();
await runMigrations();

outro(
	createdEnvs.length > 0
		? "Done. Next: open the .env files, paste in your Clerk keys, then `pnpm dev`."
		: "Done. Run `pnpm dev` to start the app.",
);
