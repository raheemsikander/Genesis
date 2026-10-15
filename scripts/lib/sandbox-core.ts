export const BASE_PORTS = {
	server: 3000,
	web: 3001,
	postgres: 5433,
	testPostgres: 5434,
	redis: 6379,
	testRedis: 6380,
	minio: 9000,
	minioConsole: 9001,
	testMinio: 9002,
	testMinioConsole: 9003,
} as const;

export type SandboxPorts = Record<keyof typeof BASE_PORTS, number>;

export type Registry = { version: 1; slots: Record<string, number> };

export function portsForSlot(slot: number): SandboxPorts {
	if (!Number.isInteger(slot) || slot < 0) {
		throw new Error(
			`Invalid sandbox slot "${slot}": must be a non-negative integer`,
		);
	}
	const offset = slot * 100;
	return Object.fromEntries(
		Object.entries(BASE_PORTS).map(([name, base]) => [name, base + offset]),
	) as SandboxPorts;
}

/**
 * Credentials and the database name are fixed by docker-compose.test.yml, so
 * the port is the only slot-dependent part. The wrapper exports these so the
 * vitest half of an integration run always targets the same ephemeral stack
 * the compose half just started, and can never fall back to the dev-stack
 * values sitting in the app's .env. The bucket is deliberately absent: it is
 * the app's own S3_BUCKET, defaulted rather than fixed, and the test stack
 * creates whichever one the app asks for.
 */
export function testDatabaseUrl(ports: SandboxPorts): string {
	return `postgresql://postgres:postgres@localhost:${ports.testPostgres}/genesis_test`;
}

export function testRedisUrl(ports: SandboxPorts): string {
	return `redis://localhost:${ports.testRedis}`;
}

export function testS3Endpoint(ports: SandboxPorts): string {
	return `http://localhost:${ports.testMinio}`;
}

export const TEST_S3_CREDENTIALS = {
	accessKeyId: "genesis",
	secretAccessKey: "genesis123",
} as const;

/**
 * Set by the wrapper on every test-stack command. The integration suite
 * refuses to run without it, so invoking vitest by hand against a dev .env
 * fails loudly instead of connecting to dev infrastructure.
 */
export const TEST_INFRA_MARKER = "GENESIS_TEST_INFRA";

/**
 * Slots are allocated across every Genesis-derived checkout on the machine,
 * not per repository, because products forked from Genesis share the same
 * base ports and would otherwise all claim slot 0.
 *
 * `isLive` decides which registry entries still deserve their slot. It must
 * stay a disk-presence question rather than a "currently running" one: a
 * checkout that is merely idle still owns generated .env files and stopped
 * containers bound to its ports, so handing its slot to another product
 * would recreate the collision this registry exists to prevent.
 */
export function resolveSlot(input: {
	worktreePath: string;
	registry: Registry;
	isLive: (path: string) => boolean;
}): { slot: number; registry: Registry; changed: boolean } {
	const { worktreePath, registry, isLive } = input;

	const slots: Record<string, number> = {};
	let changed = false;
	for (const [path, slot] of Object.entries(registry.slots)) {
		if (path === worktreePath || isLive(path)) {
			slots[path] = slot;
		} else {
			changed = true;
		}
	}

	const existing = slots[worktreePath];
	if (existing !== undefined) {
		return { slot: existing, registry: { version: 1, slots }, changed };
	}

	const taken = new Set(Object.values(slots));
	let slot = 0;
	while (taken.has(slot)) slot++;
	slots[worktreePath] = slot;
	return { slot, registry: { version: 1, slots }, changed: true };
}

export function applySlotPorts(
	envContent: string,
	ports: SandboxPorts,
): string {
	let result = envContent;
	for (const [name, base] of Object.entries(BASE_PORTS)) {
		const port = ports[name as keyof typeof BASE_PORTS];
		if (port === base) continue;
		result = result.replaceAll(`localhost:${base}`, `localhost:${port}`);
	}
	if (ports.server !== BASE_PORTS.server) {
		result = result.replace(/^PORT=3000$/m, `PORT=${ports.server}`);
	}
	return result;
}

export type EnvPortKeys = Record<string, keyof SandboxPorts>;

export const SERVER_ENV_PORT_KEYS: EnvPortKeys = {
	PORT: "server",
	CORS_ORIGIN: "web",
	DATABASE_URL: "postgres",
	/**
	 * TEST_DATABASE_URL is deliberately absent: the wrapper exports it for the
	 * resolved slot and exported vars beat dotenv, so a drifted value in .env
	 * never reaches a test run and blocking on it would be a false alarm.
	 */
	REDIS_URL: "redis",
	S3_ENDPOINT: "minio",
};

export const WEB_ENV_PORT_KEYS: EnvPortKeys = {
	NEXT_PUBLIC_SERVER_URL: "server",
};

export type EnvPortMismatch = {
	key: string;
	expectedPort: number;
	foundPort: number;
};

function parseEnvLine(line: string): [string, string] | undefined {
	const trimmed = line.trim();
	if (trimmed === "" || trimmed.startsWith("#")) return undefined;
	const separator = trimmed.indexOf("=");
	if (separator === -1) return undefined;
	const key = trimmed.slice(0, separator).trim();
	const value = trimmed
		.slice(separator + 1)
		.trim()
		.replace(/^(['"])(.*)\1$/, "$2");
	return [key, value];
}

/**
 * A value pointing at a non-localhost host is a deliberate custom target (a
 * remote database, a LAN IP for device testing) and carries no slot, so only
 * localhost ports are checked.
 */
function localhostPorts(value: string): number[] {
	return value
		.split(",")
		.map((entry) => /localhost:(\d+)/.exec(entry.trim())?.[1])
		.filter((port) => port !== undefined)
		.map(Number);
}

/**
 * Reports port-bearing env values that belong to a different sandbox slot than
 * the one this worktree resolved to. Ports the wrapper cannot see (an app
 * reads its own .env, not the wrapper's exported ports) would otherwise
 * cross-wire two sandboxes silently.
 */
export function envPortMismatches(
	envContent: string,
	ports: SandboxPorts,
	keys: EnvPortKeys,
): EnvPortMismatch[] {
	const mismatches: EnvPortMismatch[] = [];
	const seen = new Set<string>();
	for (const line of envContent.split("\n")) {
		const parsed = parseEnvLine(line);
		if (!parsed) continue;
		const [key, value] = parsed;
		const portName = keys[key];
		// dotenv keeps the first definition, so later duplicates never apply.
		if (portName === undefined || value === "" || seen.has(key)) continue;
		seen.add(key);
		const expectedPort = ports[portName];
		const found =
			key === "PORT"
				? [Number(value)].filter(Number.isInteger)
				: localhostPorts(value);
		const wrong = found.find((port) => port !== expectedPort);
		if (wrong !== undefined) {
			mismatches.push({ key, expectedPort, foundPort: wrong });
		}
	}
	return mismatches;
}

/**
 * Project names carry the product, because two products forked from Genesis
 * run side by side on one machine and would otherwise share container names.
 *
 * The slot-0 dev stack is the one exception and returns undefined: it predates
 * sandbox slots, so the caller pins the main checkout's basename instead to
 * keep those already-created containers and volumes addressable.
 */
export function composeProjectName(
	slot: number,
	kind: "dev" | "test",
	product: string,
): string | undefined {
	if (slot === 0 && kind === "dev") return undefined;
	const base = slot === 0 ? product : `${product}-s${slot}`;
	return kind === "dev" ? base : `${base}-test`;
}

/**
 * Turns the main checkout's basename into a valid Docker Compose project
 * name, so a slot-0 override can pin that name explicitly from any cwd (a
 * linked worktree's basename differs from the main checkout's).
 */
export function sanitizeComposeProjectName(name: string): string {
	const lowered = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
	return /^[a-z0-9]/.test(lowered) ? lowered : `genesis${lowered}`;
}

/**
 * zx's own CLI sits in front of this script in process.argv (the exact
 * number of entries varies by how zx is invoked), so scan for the script
 * path itself rather than relying on a fixed slice offset.
 */
export function scriptArgs(argv: string[]): string[] {
	const index = argv.findIndex((arg) => arg.endsWith("sandbox.ts"));
	return index === -1 ? [] : argv.slice(index + 1);
}

export type ParsedArgs = {
	command: string;
	slotOverride: number | undefined;
	volumes: boolean;
	json: boolean;
	skipEnvCheck: boolean;
	rest: string[];
};

function parseSlotValue(raw: string | undefined): number {
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 0) {
		throw new Error("sandbox: --slot requires a non-negative integer");
	}
	return value;
}

export function parseArgs(argv: string[]): ParsedArgs {
	const args = [...argv];
	const command = args.shift();
	if (command === undefined) {
		throw new Error("sandbox: missing command");
	}

	let slotOverride: number | undefined;
	let skipEnvCheck = false;

	if (command === "run") {
		/**
		 * Leading --slot / --skip-env-check are ours to consume; everything else
		 * (flags included) is the child command's argv and must pass through
		 * verbatim, except trailing occurrences of the same two flags, which are
		 * also ours (e.g. `pnpm dev --slot 1` expands to
		 * `run turbo dev dev:worker --slot 1`). A leading slot override wins if
		 * both are present, but a trailing pair is always stripped from rest so
		 * it never leaks into the child command's argv.
		 */
		while (args.length > 0) {
			if (args[0] === "--skip-env-check") {
				args.shift();
				skipEnvCheck = true;
			} else if (args[0] === "--slot") {
				args.shift();
				slotOverride = parseSlotValue(args.shift());
			} else {
				break;
			}
		}
		while (args.length > 0) {
			if (args[args.length - 1] === "--skip-env-check") {
				args.length -= 1;
				skipEnvCheck = true;
			} else if (args.length >= 2 && args[args.length - 2] === "--slot") {
				const trailingSlot = parseSlotValue(args[args.length - 1]);
				args.length -= 2;
				if (slotOverride === undefined) slotOverride = trailingSlot;
			} else {
				break;
			}
		}
		return {
			command,
			slotOverride,
			volumes: false,
			json: false,
			skipEnvCheck,
			rest: args,
		};
	}

	let volumes = false;
	let json = false;
	const rest: string[] = [];
	while (args.length > 0) {
		const arg = args.shift() as string;
		if (arg === "--slot") {
			slotOverride = parseSlotValue(args.shift());
		} else if (arg === "--volumes") {
			volumes = true;
		} else if (arg === "--json") {
			json = true;
		} else if (arg === "--skip-env-check") {
			skipEnvCheck = true;
		} else {
			rest.push(arg);
		}
	}
	return { command, slotOverride, volumes, json, skipEnvCheck, rest };
}

export function isValidRegistry(value: unknown): value is Registry {
	if (typeof value !== "object" || value === null) return false;
	const record = value as { version?: unknown; slots?: unknown };
	if (record.version !== 1) return false;
	const slots = record.slots;
	if (typeof slots !== "object" || slots === null || Array.isArray(slots)) {
		return false;
	}
	return Object.values(slots).every(
		(slot) => Number.isInteger(slot) && (slot as number) >= 0,
	);
}
