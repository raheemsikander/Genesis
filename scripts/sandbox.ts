#!/usr/bin/env zx
/**
 * Sandbox slot CLI for parallel worktrees and parallel products.
 *
 * Every checkout on the machine gets a slot number that offsets its host
 * ports by slot * 100, so worktrees of one product and separate products
 * forked from Genesis all run side by side.
 * See docs/engineering/parallel-sandboxes.md.
 */

import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
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
	TEST_INFRA_MARKER,
	TEST_S3_CREDENTIALS,
	testDatabaseUrl,
	testRedisUrl,
	testS3Endpoint,
	WEB_ENV_PORT_KEYS,
} from "./lib/sandbox-core.ts";

$.verbose = false;

/**
 * Machine-global rather than per-repository: every product forked from Genesis
 * shares the same base ports, so slots have to be allocated across all of them
 * at once for two products to run side by side.
 */
function registryPath(): string {
	const override = process.env.GENESIS_SANDBOX_REGISTRY;
	if (override !== undefined && override !== "") return resolve(override);
	return join(homedir(), ".genesis", "sandboxes.json");
}

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
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp-${process.pid}`;
	writeFileSync(tmp, `${JSON.stringify(registry, null, "\t")}\n`);
	renameSync(tmp, path);
}

const LOCK_RETRY_MS = 20;
const LOCK_TIMEOUT_MS = 5_000;
const STALE_LOCK_MS = 30_000;

function lockIsStale(lockPath: string): boolean {
	try {
		return Date.now() - statSync(lockPath).mtimeMs > STALE_LOCK_MS;
	} catch {
		// Already gone: another holder released it, so stop treating it as stale.
		return false;
	}
}

/**
 * Claiming a slot is read-compute-write on one file shared by every checkout
 * on the machine, so two commands starting together would both see the same
 * lowest free slot and the last writer would silently win, putting two
 * sandboxes on one set of ports. Exclusive create is the portable atomic
 * primitive for this; a killed process leaves its lock behind, so one older
 * than STALE_LOCK_MS is reclaimed rather than blocking forever.
 */
async function withRegistryLock<T>(path: string, claim: () => T): Promise<T> {
	const lockPath = `${path}.lock`;
	mkdirSync(dirname(path), { recursive: true });
	const deadline = Date.now() + LOCK_TIMEOUT_MS;
	for (;;) {
		try {
			writeFileSync(lockPath, String(process.pid), { flag: "wx" });
			break;
		} catch {
			if (lockIsStale(lockPath)) {
				rmSync(lockPath, { force: true });
				continue;
			}
			if (Date.now() > deadline) {
				throw new Error(
					`sandbox: timed out waiting for the slot registry lock at ${lockPath}. ` +
						"Delete it if no other sandbox command is running.",
				);
			}
			await sleep(LOCK_RETRY_MS);
		}
	}
	try {
		return claim();
	} finally {
		rmSync(lockPath, { force: true });
	}
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
	const path = registryPath();
	const worktreePath = await gitWorktreeRoot();
	return withRegistryLock(path, () => {
		const { slot, registry, changed } = resolveSlot({
			worktreePath,
			registry: readRegistry(path),
			isLive: existsSync,
		});
		if (changed) writeRegistryAtomic(path, registry);
		return slot;
	});
}

/**
 * `name` identifies the product across every checkout of it on the machine
 * and comes from the root package.json, which `pnpm rename` rewrites per
 * fork. `slotZeroDevProject` is the pre-sandbox default that the slot-0 dev
 * stack keeps so its existing containers and volumes stay addressable.
 */
type Product = { name: string; slotZeroDevProject: string };

function packageName(mainPath: string): string | undefined {
	try {
		const parsed: unknown = JSON.parse(
			readFileSync(join(mainPath, "package.json"), "utf8"),
		);
		const name = (parsed as { name?: unknown }).name;
		return typeof name === "string" && name !== ""
			? sanitizeComposeProjectName(name)
			: undefined;
	} catch {
		return undefined;
	}
}

async function resolveProduct(): Promise<Product> {
	const mainPath = await mainWorktreePath();
	const slotZeroDevProject = sanitizeComposeProjectName(basename(mainPath));
	return {
		name: packageName(mainPath) ?? slotZeroDevProject,
		slotZeroDevProject,
	};
}

function slotEnv(
	slot: number,
	ports: SandboxPorts,
	kind: "dev" | "test",
	product: Product,
): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {
		...process.env,
		GENESIS_SLOT: String(slot),
		SERVER_PORT: String(ports.server),
		WEB_PORT: String(ports.web),
		POSTGRES_PORT: String(ports.postgres),
		TEST_POSTGRES_PORT: String(ports.testPostgres),
		REDIS_PORT: String(ports.redis),
		TEST_REDIS_PORT: String(ports.testRedis),
		MINIO_PORT: String(ports.minio),
		MINIO_CONSOLE_PORT: String(ports.minioConsole),
		TEST_MINIO_PORT: String(ports.testMinio),
		TEST_MINIO_CONSOLE_PORT: String(ports.testMinioConsole),
		/**
		 * Exported for both kinds because the test database has always been
		 * wrapper-owned: it is an ephemeral stack with credentials fixed by
		 * docker-compose.test.yml, and deriving the URL here keeps the vitest
		 * half of an integration run on the same slot as the compose half.
		 */
		TEST_DATABASE_URL: testDatabaseUrl(ports),
	};
	if (kind === "test") {
		/**
		 * Redis and S3 have no test-specific variable for the app to read, so
		 * pointing a test run at the ephemeral stack means overriding the real
		 * ones. Exported values beat dotenv, so this is what makes reaching the
		 * dev stack impossible rather than merely unlikely: without it
		 * redis.ts falls back to the dev Redis and the S3 client writes into
		 * the bucket the developer is using.
		 */
		env.REDIS_URL = testRedisUrl(ports);
		env.S3_ENDPOINT = testS3Endpoint(ports);
		env.S3_PUBLIC_ENDPOINT = testS3Endpoint(ports);
		env.S3_ACCESS_KEY_ID = TEST_S3_CREDENTIALS.accessKeyId;
		env.S3_SECRET_ACCESS_KEY = TEST_S3_CREDENTIALS.secretAccessKey;
		env[TEST_INFRA_MARKER] = "1";
	}
	env.COMPOSE_PROJECT_NAME = resolvedComposeProjectName(slot, kind, product);
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
 * Pinning the slot-0 dev name rather than letting Docker derive it also fixes
 * cwd: Docker's default comes from the *current* directory's basename, which
 * is wrong when a linked worktree targets slot 0 via --slot 0 or
 * GENESIS_SLOT=0. For compose-safe basenames (like this repo's) the pinned
 * value matches Docker's previous default; a basename needing sanitization
 * diverges from Docker's own normalizer, so a pre-existing default-named
 * stack must be stopped once with plain docker compose.
 */
function resolvedComposeProjectName(
	slot: number,
	kind: "dev" | "test",
	product: Product,
): string {
	return (
		composeProjectName(slot, kind, product.name) ?? product.slotZeroDevProject
	);
}

function printInfo(
	slot: number,
	ports: SandboxPorts,
	product: Product,
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
			testDatabase: testDatabaseUrl(ports),
			redis: `redis://localhost:${ports.redis}`,
			testRedis: testRedisUrl(ports),
			s3: `http://localhost:${ports.minio}`,
			testS3: testS3Endpoint(ports),
		},
		composeProjects: {
			dev: resolvedComposeProjectName(slot, "dev", product),
			test: resolvedComposeProjectName(slot, "test", product),
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
		`  test infra  redis ${info.connectionStrings.testRedis}  s3 ${info.connectionStrings.testS3}`,
	);
	console.log(
		`  compose  dev=${info.composeProjects.dev} test=${info.composeProjects.test}`,
	);
}

function composeArgs(
	slot: number,
	kind: "dev" | "test",
	product: Product,
): string[] {
	const project = resolvedComposeProjectName(slot, kind, product);
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
	product: Product,
): string[] {
	return [
		"docker",
		"compose",
		...composeArgs(slot, kind, product),
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
const product = await resolveProduct();

async function preflightEnv(): Promise<void> {
	if (skipEnvCheck || process.env.GENESIS_SKIP_ENV_CHECK === "1") return;
	assertEnvMatchesSlot(slot, ports, await gitWorktreeRoot());
}

switch (command) {
	case "info":
		printInfo(slot, ports, product, json);
		break;
	case "run":
		await preflightEnv();
		run(rest, slotEnv(slot, ports, "dev", product));
		break;
	case "infra": {
		const [sub] = rest;
		const downArgs = volumes ? ["-v"] : [];
		if (sub === "up") {
			await preflightEnv();
			run(
				composeUpCommand(slot, "dev", product),
				slotEnv(slot, ports, "dev", product),
			);
		} else if (sub === "down") {
			run(
				[
					"docker",
					"compose",
					...composeArgs(slot, "dev", product),
					"down",
					...downArgs,
				],
				slotEnv(slot, ports, "dev", product),
			);
		} else if (sub === "test-up") {
			run(
				composeUpCommand(slot, "test", product),
				slotEnv(slot, ports, "test", product),
			);
		} else if (sub === "test-down") {
			run(
				[
					"docker",
					"compose",
					...composeArgs(slot, "test", product),
					"down",
					...downArgs,
				],
				slotEnv(slot, ports, "test", product),
			);
		} else if (sub === "bucket-init") {
			run(
				[
					"docker",
					"compose",
					...composeArgs(slot, "dev", product),
					"run",
					"--rm",
					"minio-init",
				],
				slotEnv(slot, ports, "dev", product),
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
		const env = slotEnv(slot, ports, "test", product);
		const upStatus = runToCompletion(
			composeUpCommand(slot, "test", product),
			env,
		);
		if (upStatus !== 0) process.exit(upStatus);
		const bucketStatus = runToCompletion(
			[
				"docker",
				"compose",
				...composeArgs(slot, "test", product),
				"run",
				"--rm",
				"test-minio-init",
			],
			env,
		);
		if (bucketStatus !== 0) process.exit(bucketStatus);
		run(["pnpm", "--filter", "server", "test:integration", ...rest], env);
		break;
	}
	default:
		throw new Error(`sandbox: unknown command "${command}"`);
}
