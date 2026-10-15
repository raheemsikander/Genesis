#!/usr/bin/env zx
/**
 * Sandbox slot CLI for parallel worktrees.
 *
 * Each worktree gets a slot number (main checkout = 0) that offsets every
 * host port by slot * 100, so several worktrees can run infra, dev servers,
 * and tests side by side. See docs/engineering/parallel-sandboxes.md.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { $ } from "zx";
import {
	composeProjectName,
	type EnvPortKeys,
	envPortMismatches,
	isValidRegistry,
	parseArgs,
	portsForSlot,
	type Registry,
	resolveSlot,
	type SandboxPorts,
	SERVER_ENV_PORT_KEYS,
	sanitizeComposeProjectName,
	scriptArgs,
	testDatabaseUrl,
	WEB_ENV_PORT_KEYS,
} from "./lib/sandbox-core.ts";

$.verbose = false;

const REGISTRY_FILE = "genesis-sandboxes.json";

async function gitCommonDir(): Promise<string> {
	try {
		const out = await $`git rev-parse --path-format=absolute --git-common-dir`;
		return out.stdout.trim();
	} catch {
		throw new Error("sandbox: not inside a git checkout");
	}
}

async function gitWorktreeRoot(): Promise<string> {
	try {
		/**
		 * --show-toplevel is already absolute; --path-format only affects
		 * arguments that come after it, so it doesn't need to be passed here.
		 */
		const out = await $`git rev-parse --show-toplevel`;
		return out.stdout.trim();
	} catch {
		throw new Error("sandbox: not inside a git checkout");
	}
}

async function mainWorktreePath(): Promise<string> {
	return resolve(dirname(await gitCommonDir()));
}

async function activeWorktreePaths(): Promise<string[]> {
	const out = await $`git worktree list --porcelain`;
	return out.stdout
		.split("\n")
		.filter((line) => line.startsWith("worktree "))
		.map((line) => resolve(line.slice("worktree ".length)));
}

function readRegistry(path: string): Registry {
	if (!existsSync(path)) return { version: 1, slots: {} };
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		if (isValidRegistry(parsed)) return parsed;
	} catch {
		// Corrupt registry: fall through and rebuild from scratch.
	}
	return { version: 1, slots: {} };
}

function writeRegistryAtomic(path: string, registry: Registry): void {
	/**
	 * Write the temp file next to the target so the rename stays on the same
	 * filesystem: os.tmpdir() can be a different mount, which makes rename
	 * throw EXDEV instead of completing atomically.
	 */
	const tmp = `${path}.tmp-${process.pid}`;
	writeFileSync(tmp, `${JSON.stringify(registry, null, "\t")}\n`);
	renameSync(tmp, path);
}

async function currentSlot(slotOverride: number | undefined): Promise<number> {
	if (slotOverride !== undefined) return slotOverride;
	const envSlot = process.env.GENESIS_SLOT;
	if (envSlot !== undefined && envSlot !== "") {
		const value = Number(envSlot);
		if (!Number.isInteger(value) || value < 0) {
			throw new Error(
				`sandbox: GENESIS_SLOT must be a non-negative integer, got "${envSlot}"`,
			);
		}
		return value;
	}
	const commonDir = await gitCommonDir();
	const worktreePath = await gitWorktreeRoot();
	const registryPath = join(commonDir, REGISTRY_FILE);
	const { slot, registry, changed } = resolveSlot({
		worktreePath,
		mainWorktreePath: resolve(dirname(commonDir)),
		activeWorktreePaths: await activeWorktreePaths(),
		registry: readRegistry(registryPath),
	});
	if (changed) writeRegistryAtomic(registryPath, registry);
	return slot;
}

function slotEnv(
	slot: number,
	ports: SandboxPorts,
	kind: "dev" | "test" = "dev",
): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {
		...process.env,
		GENESIS_SLOT: String(slot),
		SERVER_PORT: String(ports.server),
		WEB_PORT: String(ports.web),
		POSTGRES_PORT: String(ports.postgres),
		TEST_POSTGRES_PORT: String(ports.testPostgres),
		REDIS_PORT: String(ports.redis),
		MINIO_PORT: String(ports.minio),
		MINIO_CONSOLE_PORT: String(ports.minioConsole),
		/**
		 * The only connection string the wrapper owns. The test database is an
		 * ephemeral tmpfs stack with credentials hardcoded in
		 * docker-compose.test.yml, so deriving it here is safe, and it keeps the
		 * vitest half of an integration run on the same slot as the compose half.
		 * Every other connection string stays with the app's .env.
		 */
		TEST_DATABASE_URL: testDatabaseUrl(ports),
	};
	const project = composeProjectName(slot, kind);
	if (project) env.COMPOSE_PROJECT_NAME = project;
	return env;
}

function runToCompletion(cmd: string[], env: NodeJS.ProcessEnv): number {
	const [bin, ...args] = cmd;
	if (!bin) throw new Error("sandbox run: missing command");
	const result = spawnSync(bin, args, { stdio: "inherit", env });
	if (result.error) throw result.error;
	return result.status ?? (result.signal ? 130 : 1);
}

function run(cmd: string[], env: NodeJS.ProcessEnv): never {
	process.exit(runToCompletion(cmd, env));
}

/**
 * At slot 0, Docker's own default project name would come from the
 * *current* directory's basename, which is wrong when invoked from a linked
 * worktree targeting slot 0 via --slot 0 or GENESIS_SLOT=0. Pinning it to a
 * sanitized form of the main checkout's basename keeps that one stack
 * addressable from anywhere. For compose-safe basenames (like this repo's)
 * the value matches Docker's previous default; a basename needing
 * sanitization diverges from Docker's own normalizer, so a pre-existing
 * default-named stack must be stopped once with plain docker compose.
 */
function resolvedComposeProjectName(
	slot: number,
	kind: "dev" | "test",
	mainPath: string,
): string {
	return (
		composeProjectName(slot, kind) ??
		sanitizeComposeProjectName(basename(mainPath))
	);
}

function printInfo(
	slot: number,
	ports: SandboxPorts,
	mainPath: string,
	json: boolean,
): void {
	const info = {
		slot,
		ports,
		urls: {
			server: `http://localhost:${ports.server}`,
			web: `http://localhost:${ports.web}`,
			minioConsole: `http://localhost:${ports.minioConsole}`,
		},
		connectionStrings: {
			database: `postgresql://genesis:genesis@localhost:${ports.postgres}/genesis`,
			testDatabase: `postgresql://postgres:postgres@localhost:${ports.testPostgres}/genesis_test`,
			redis: `redis://localhost:${ports.redis}`,
			s3: `http://localhost:${ports.minio}`,
		},
		composeProjects: {
			dev: resolvedComposeProjectName(slot, "dev", mainPath),
			test: resolvedComposeProjectName(slot, "test", mainPath),
		},
	};
	if (json) {
		console.log(JSON.stringify(info, null, 2));
		return;
	}
	console.log(`Sandbox slot ${slot}`);
	console.log(`  server   ${info.urls.server}`);
	console.log(`  web      ${info.urls.web}`);
	console.log(`  postgres ${info.connectionStrings.database}`);
	console.log(`  test db  ${info.connectionStrings.testDatabase}`);
	console.log(`  redis    ${info.connectionStrings.redis}`);
	console.log(
		`  minio    ${info.connectionStrings.s3} (console ${info.urls.minioConsole})`,
	);
	console.log(
		`  compose  dev=${info.composeProjects.dev} test=${info.composeProjects.test}`,
	);
}

function composeArgs(
	slot: number,
	kind: "dev" | "test",
	mainPath: string,
): string[] {
	const project = resolvedComposeProjectName(slot, kind, mainPath);
	const file = kind === "test" ? ["-f", "docker-compose.test.yml"] : [];
	return ["-p", project, ...file];
}

const ENV_PREFLIGHT_FILES: { path: string; keys: EnvPortKeys }[] = [
	{ path: "apps/server/.env", keys: SERVER_ENV_PORT_KEYS },
	{ path: "apps/web/.env", keys: WEB_ENV_PORT_KEYS },
];

/**
 * The wrapper exports ports, but the apps read their own .env, so a stale or
 * hand-edited file can point a dev server at another sandbox's database while
 * everything else follows this slot. Nothing downstream would report that, so
 * refuse to start instead.
 */
function assertEnvMatchesSlot(
	slot: number,
	ports: SandboxPorts,
	worktreeRoot: string,
): void {
	const problems = ENV_PREFLIGHT_FILES.map(({ path, keys }) => {
		const fullPath = join(worktreeRoot, path);
		if (!existsSync(fullPath)) return { path, mismatches: [] };
		return {
			path,
			mismatches: envPortMismatches(
				readFileSync(fullPath, "utf8"),
				ports,
				keys,
			),
		};
	}).filter(({ mismatches }) => mismatches.length > 0);

	if (problems.length === 0) return;

	console.error(
		`sandbox: this worktree resolved to sandbox slot ${slot}, but its env files point at other ports.`,
	);
	for (const { path, mismatches } of problems) {
		console.error(`  ${path}`);
		for (const { key, expectedPort, foundPort } of mismatches) {
			console.error(
				`    ${key}: expected port ${expectedPort}, found ${foundPort}`,
			);
		}
	}
	console.error(
		[
			"",
			"Fix it one of these ways:",
			"  - edit the keys listed above in place, changing each port to the expected one (keeps your Clerk keys and other secrets)",
			"  - regenerate from scratch: delete apps/server/.env apps/web/.env, run pnpm setup, then paste your Clerk keys back in",
			"  - target the slot these files were generated for: set GENESIS_SLOT to that slot",
			"  - keep an intentional custom value (a remote database, a shared service): pass --skip-env-check or set GENESIS_SKIP_ENV_CHECK=1",
		].join("\n"),
	);
	process.exit(1);
}

function composeUpCommand(
	slot: number,
	kind: "dev" | "test",
	mainPath: string,
): string[] {
	return [
		"docker",
		"compose",
		...composeArgs(slot, kind, mainPath),
		"up",
		"-d",
		"--wait",
	];
}

const { command, slotOverride, volumes, json, skipEnvCheck, rest } = parseArgs(
	scriptArgs(process.argv),
);
const slot = await currentSlot(slotOverride);
const ports = portsForSlot(slot);

async function preflightEnv(): Promise<void> {
	if (skipEnvCheck || process.env.GENESIS_SKIP_ENV_CHECK === "1") return;
	assertEnvMatchesSlot(slot, ports, await gitWorktreeRoot());
}

switch (command) {
	case "info":
		printInfo(slot, ports, await mainWorktreePath(), json);
		break;
	case "run":
		await preflightEnv();
		run(rest, slotEnv(slot, ports, "dev"));
		break;
	case "infra": {
		const [sub] = rest;
		const downArgs = volumes ? ["-v"] : [];
		const mainPath = await mainWorktreePath();
		if (sub === "up") {
			await preflightEnv();
			run(composeUpCommand(slot, "dev", mainPath), slotEnv(slot, ports, "dev"));
		} else if (sub === "down") {
			run(
				[
					"docker",
					"compose",
					...composeArgs(slot, "dev", mainPath),
					"down",
					...downArgs,
				],
				slotEnv(slot, ports, "dev"),
			);
		} else if (sub === "test-up") {
			run(
				composeUpCommand(slot, "test", mainPath),
				slotEnv(slot, ports, "test"),
			);
		} else if (sub === "test-down") {
			run(
				[
					"docker",
					"compose",
					...composeArgs(slot, "test", mainPath),
					"down",
					...downArgs,
				],
				slotEnv(slot, ports, "test"),
			);
		} else if (sub === "bucket-init") {
			run(
				[
					"docker",
					"compose",
					...composeArgs(slot, "dev", mainPath),
					"run",
					"--rm",
					"minio-init",
				],
				slotEnv(slot, ports, "dev"),
			);
		} else {
			throw new Error(`sandbox infra: unknown subcommand "${sub ?? ""}"`);
		}
		break;
	}
	case "integration": {
		/**
		 * Both halves of an integration run must agree on the slot, so they
		 * share one resolution here instead of being chained in package.json.
		 */
		const env = slotEnv(slot, ports, "test");
		const upStatus = runToCompletion(
			composeUpCommand(slot, "test", await mainWorktreePath()),
			env,
		);
		if (upStatus !== 0) process.exit(upStatus);
		run(["pnpm", "--filter", "server", "test:integration", ...rest], env);
		break;
	}
	default:
		throw new Error(`sandbox: unknown command "${command}"`);
}
