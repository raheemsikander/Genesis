import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	applySlotPorts,
	BASE_PORTS,
	composeProjectName,
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
} from "./sandbox-core";

const emptyRegistry = (): Registry => ({ version: 1, slots: {} });

describe("portsForSlot", () => {
	it("returns base ports for slot 0", () => {
		expect(portsForSlot(0)).toEqual(BASE_PORTS);
	});

	it("offsets every port by slot * 100", () => {
		expect(portsForSlot(2)).toEqual({
			server: 3200,
			web: 3201,
			postgres: 5633,
			testPostgres: 5634,
			redis: 6579,
			minio: 9200,
			minioConsole: 9201,
		});
	});

	it("rejects negative and non-integer slots", () => {
		expect(() => portsForSlot(-1)).toThrow(/slot/i);
		expect(() => portsForSlot(1.5)).toThrow(/slot/i);
	});
});

describe("testDatabaseUrl", () => {
	it("matches the committed .env.example value at slot 0", () => {
		expect(testDatabaseUrl(portsForSlot(0))).toBe(
			"postgresql://postgres:postgres@localhost:5434/genesis_test",
		);
	});

	it("follows the slot's test postgres port", () => {
		expect(testDatabaseUrl(portsForSlot(9))).toBe(
			"postgresql://postgres:postgres@localhost:6334/genesis_test",
		);
	});
});

describe("resolveSlot", () => {
	const main = "/repos/genesis";

	it("always gives the main worktree slot 0 without touching the registry", () => {
		const result = resolveSlot({
			worktreePath: main,
			mainWorktreePath: main,
			activeWorktreePaths: [main],
			registry: emptyRegistry(),
		});
		expect(result.slot).toBe(0);
		expect(result.changed).toBe(false);
		expect(result.registry.slots).toEqual({});
	});

	it("claims the lowest free slot >= 1 for a new worktree", () => {
		const result = resolveSlot({
			worktreePath: "/repos/wt-a",
			mainWorktreePath: main,
			activeWorktreePaths: [main, "/repos/wt-a"],
			registry: emptyRegistry(),
		});
		expect(result.slot).toBe(1);
		expect(result.changed).toBe(true);
		expect(result.registry.slots).toEqual({ "/repos/wt-a": 1 });
	});

	it("returns the already-registered slot unchanged", () => {
		const registry: Registry = { version: 1, slots: { "/repos/wt-a": 3 } };
		const result = resolveSlot({
			worktreePath: "/repos/wt-a",
			mainWorktreePath: main,
			activeWorktreePaths: [main, "/repos/wt-a"],
			registry,
		});
		expect(result.slot).toBe(3);
		expect(result.changed).toBe(false);
	});

	it("fills gaps left by removed worktrees", () => {
		const registry: Registry = {
			version: 1,
			slots: { "/repos/wt-a": 1, "/repos/wt-c": 3 },
		};
		const result = resolveSlot({
			worktreePath: "/repos/wt-d",
			mainWorktreePath: main,
			activeWorktreePaths: [main, "/repos/wt-a", "/repos/wt-c", "/repos/wt-d"],
			registry,
		});
		expect(result.slot).toBe(2);
	});

	it("prunes registry entries for worktrees that no longer exist", () => {
		const registry: Registry = {
			version: 1,
			slots: { "/repos/gone": 1, "/repos/wt-a": 2 },
		};
		const result = resolveSlot({
			worktreePath: "/repos/wt-b",
			mainWorktreePath: main,
			activeWorktreePaths: [main, "/repos/wt-a", "/repos/wt-b"],
			registry,
		});
		expect(result.registry.slots).toEqual({
			"/repos/wt-a": 2,
			"/repos/wt-b": 1,
		});
		expect(result.slot).toBe(1);
		expect(result.changed).toBe(true);
	});
});

describe("applySlotPorts", () => {
	it("rewrites every base localhost port and the PORT line for the slot", () => {
		const template = [
			"PORT=3000",
			"CORS_ORIGIN=http://localhost:3001",
			"DATABASE_URL=postgresql://genesis:genesis@localhost:5433/genesis",
			"TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/genesis_test",
			"REDIS_URL=redis://localhost:6379",
			"S3_ENDPOINT=http://localhost:9000",
			"NEXT_PUBLIC_SERVER_URL=http://localhost:3000",
		].join("\n");
		const result = applySlotPorts(template, portsForSlot(1));
		expect(result).toContain("PORT=3100");
		expect(result).toContain("CORS_ORIGIN=http://localhost:3101");
		expect(result).toContain("localhost:5533/genesis");
		expect(result).toContain("localhost:5534/genesis_test");
		expect(result).toContain("redis://localhost:6479");
		expect(result).toContain("S3_ENDPOINT=http://localhost:9100");
		expect(result).toContain("NEXT_PUBLIC_SERVER_URL=http://localhost:3100");
	});

	it("is a no-op for slot 0", () => {
		const template = "PORT=3000\nREDIS_URL=redis://localhost:6379\n";
		expect(applySlotPorts(template, portsForSlot(0))).toBe(template);
	});
});

describe("envPortMismatches", () => {
	const serverEnv = (ports: SandboxPorts) =>
		[
			`PORT=${ports.server}`,
			`CORS_ORIGIN=http://localhost:${ports.web}`,
			`DATABASE_URL=postgresql://genesis:genesis@localhost:${ports.postgres}/genesis`,
			`TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:${ports.testPostgres}/genesis_test`,
			`REDIS_URL=redis://localhost:${ports.redis}`,
			`S3_ENDPOINT=http://localhost:${ports.minio}`,
		].join("\n");

	it("returns nothing when every port matches the slot", () => {
		expect(
			envPortMismatches(
				serverEnv(portsForSlot(0)),
				portsForSlot(0),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([]);
		expect(
			envPortMismatches(
				serverEnv(portsForSlot(1)),
				portsForSlot(1),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([]);
	});

	it("flags every stale slot-0 key when the worktree resolved to slot 1", () => {
		const result = envPortMismatches(
			serverEnv(portsForSlot(0)),
			portsForSlot(1),
			SERVER_ENV_PORT_KEYS,
		);
		expect(result).toEqual([
			{ key: "PORT", expectedPort: 3100, foundPort: 3000 },
			{ key: "CORS_ORIGIN", expectedPort: 3101, foundPort: 3001 },
			{ key: "DATABASE_URL", expectedPort: 5533, foundPort: 5433 },
			{ key: "REDIS_URL", expectedPort: 6479, foundPort: 6379 },
			{ key: "S3_ENDPOINT", expectedPort: 9100, foundPort: 9000 },
		]);
	});

	it("ignores a drifted TEST_DATABASE_URL, which the wrapper exports itself", () => {
		expect(
			envPortMismatches(
				"TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/genesis_test\n",
				portsForSlot(0),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([]);
	});

	it("still flags a drifted DATABASE_URL, which stays .env-owned", () => {
		expect(
			envPortMismatches(
				"DATABASE_URL=postgresql://genesis:genesis@localhost:5433/genesis\n",
				portsForSlot(1),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([{ key: "DATABASE_URL", expectedPort: 5533, foundPort: 5433 }]);
	});

	it("flags the web server URL against the server port", () => {
		expect(
			envPortMismatches(
				"NEXT_PUBLIC_SERVER_URL=http://localhost:3000\n",
				portsForSlot(2),
				WEB_ENV_PORT_KEYS,
			),
		).toEqual([
			{ key: "NEXT_PUBLIC_SERVER_URL", expectedPort: 3200, foundPort: 3000 },
		]);
	});

	it("skips keys that are absent, empty, or not port-bearing", () => {
		expect(
			envPortMismatches(
				"REDIS_URL=\nCLERK_SECRET_KEY=sk_test_xxx\nS3_PUBLIC_ENDPOINT=http://192.168.1.10:9000\n",
				portsForSlot(1),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([]);
	});

	it("skips commented-out lines", () => {
		expect(
			envPortMismatches(
				"# DATABASE_URL=postgresql://genesis:genesis@localhost:5433/genesis\n",
				portsForSlot(1),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([]);
	});

	it("leaves a custom non-localhost target alone", () => {
		expect(
			envPortMismatches(
				"DATABASE_URL=postgresql://user:pw@db.example.com:5432/app\n",
				portsForSlot(1),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([]);
	});

	it("checks only the localhost entries of a comma-separated origin list", () => {
		expect(
			envPortMismatches(
				"CORS_ORIGIN=http://localhost:3101,https://preview.example.com\n",
				portsForSlot(1),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([]);
		expect(
			envPortMismatches(
				"CORS_ORIGIN=https://preview.example.com,http://localhost:3001\n",
				portsForSlot(1),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([{ key: "CORS_ORIGIN", expectedPort: 3101, foundPort: 3001 }]);
	});

	it("honors only the first definition of a duplicated key, like dotenv", () => {
		expect(
			envPortMismatches(
				"REDIS_URL=redis://localhost:6479\nREDIS_URL=redis://localhost:6379\n",
				portsForSlot(1),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([]);
	});

	it("ignores a non-numeric PORT rather than reporting NaN", () => {
		expect(
			envPortMismatches("PORT=abc\n", portsForSlot(1), SERVER_ENV_PORT_KEYS),
		).toEqual([]);
	});

	it("tolerates quoted values", () => {
		expect(
			envPortMismatches(
				'REDIS_URL="redis://localhost:6379"\n',
				portsForSlot(1),
				SERVER_ENV_PORT_KEYS,
			),
		).toEqual([{ key: "REDIS_URL", expectedPort: 6479, foundPort: 6379 }]);
	});
});

describe("composeProjectName", () => {
	it("leaves slot 0 unnamed so the caller can pin the main checkout's basename", () => {
		expect(composeProjectName(0, "dev")).toBeUndefined();
		expect(composeProjectName(0, "test")).toBeUndefined();
	});

	it("namespaces dev and test stacks per slot", () => {
		expect(composeProjectName(2, "dev")).toBe("genesis-s2");
		expect(composeProjectName(2, "test")).toBe("genesis-s2-test");
	});
});

describe("sanitizeComposeProjectName", () => {
	it("leaves an already-valid basename untouched", () => {
		expect(sanitizeComposeProjectName("genesis-2")).toBe("genesis-2");
	});

	it("lowercases and replaces disallowed characters with a hyphen", () => {
		expect(sanitizeComposeProjectName("Genesis_2 Copy")).toBe("genesis_2-copy");
	});

	it("prefixes genesis when the first character isn't alphanumeric", () => {
		expect(sanitizeComposeProjectName("-worktree")).toBe("genesis-worktree");
	});
});

describe("scriptArgs", () => {
	it("locates argv after the sandbox.ts script path regardless of zx's own prefix", () => {
		expect(
			scriptArgs([
				"/usr/bin/node",
				"/usr/local/bin/zx",
				"/repo/scripts/sandbox.ts",
				"run",
				"turbo",
				"dev",
			]),
		).toEqual(["run", "turbo", "dev"]);
	});

	it("returns an empty array when the script path is not found", () => {
		expect(scriptArgs(["/usr/bin/node", "/usr/local/bin/zx"])).toEqual([]);
	});
});

describe("parseArgs", () => {
	it("consumes only a leading --slot for run and passes everything else through verbatim", () => {
		expect(parseArgs(["run", "--slot", "1", "turbo", "dev"])).toEqual({
			command: "run",
			slotOverride: 1,
			volumes: false,
			json: false,
			skipEnvCheck: false,
			rest: ["turbo", "dev"],
		});
	});

	it("passes flags belonging to the child command through untouched for run", () => {
		expect(parseArgs(["run", "pnpm", "--filter", "web", "test:e2e"])).toEqual({
			command: "run",
			slotOverride: undefined,
			volumes: false,
			json: false,
			skipEnvCheck: false,
			rest: ["pnpm", "--filter", "web", "test:e2e"],
		});
	});

	it("honors a trailing --slot for run", () => {
		expect(parseArgs(["run", "turbo", "dev", "--slot", "1"])).toEqual({
			command: "run",
			slotOverride: 1,
			volumes: false,
			json: false,
			skipEnvCheck: false,
			rest: ["turbo", "dev"],
		});
	});

	it("honors a trailing --slot after child flags for run", () => {
		expect(
			parseArgs(["run", "pnpm", "--filter", "web", "test:e2e", "--slot", "2"]),
		).toEqual({
			command: "run",
			slotOverride: 2,
			volumes: false,
			json: false,
			skipEnvCheck: false,
			rest: ["pnpm", "--filter", "web", "test:e2e"],
		});
	});

	it("throws on a non-numeric trailing --slot value for run", () => {
		expect(() => parseArgs(["run", "turbo", "dev", "--slot", "x"])).toThrow(
			/slot/i,
		);
	});

	it("strips a trailing --skip-env-check for run instead of leaking it to the child", () => {
		expect(parseArgs(["run", "turbo", "dev", "--skip-env-check"])).toEqual({
			command: "run",
			slotOverride: undefined,
			volumes: false,
			json: false,
			skipEnvCheck: true,
			rest: ["turbo", "dev"],
		});
	});

	it("strips trailing --slot and --skip-env-check for run in either order", () => {
		const expected = {
			command: "run",
			slotOverride: 1,
			volumes: false,
			json: false,
			skipEnvCheck: true,
			rest: ["turbo", "dev"],
		};
		expect(
			parseArgs(["run", "turbo", "dev", "--slot", "1", "--skip-env-check"]),
		).toEqual(expected);
		expect(
			parseArgs(["run", "turbo", "dev", "--skip-env-check", "--slot", "1"]),
		).toEqual(expected);
	});

	it("consumes a leading --skip-env-check for run", () => {
		expect(
			parseArgs(["run", "--skip-env-check", "--slot", "1", "turbo", "dev"]),
		).toEqual({
			command: "run",
			slotOverride: 1,
			volumes: false,
			json: false,
			skipEnvCheck: true,
			rest: ["turbo", "dev"],
		});
	});

	it("parses --skip-env-check for infra subcommands", () => {
		expect(parseArgs(["infra", "up", "--skip-env-check"])).toEqual({
			command: "infra",
			slotOverride: undefined,
			volumes: false,
			json: false,
			skipEnvCheck: true,
			rest: ["up"],
		});
	});

	it("parses --json for info", () => {
		expect(parseArgs(["info", "--json"])).toEqual({
			command: "info",
			slotOverride: undefined,
			volumes: false,
			json: true,
			skipEnvCheck: false,
			rest: [],
		});
	});

	it("parses --slot for infra subcommands", () => {
		expect(parseArgs(["infra", "up", "--slot", "2"])).toEqual({
			command: "infra",
			slotOverride: 2,
			volumes: false,
			json: false,
			skipEnvCheck: false,
			rest: ["up"],
		});
	});

	it("parses --volumes", () => {
		expect(parseArgs(["infra", "down", "--volumes"])).toEqual({
			command: "infra",
			slotOverride: undefined,
			volumes: true,
			json: false,
			skipEnvCheck: false,
			rest: ["down"],
		});
	});

	it("throws on a non-numeric --slot value", () => {
		expect(() => parseArgs(["info", "--slot", "x"])).toThrow(/slot/i);
	});

	it("throws on empty argv instead of silently defaulting to info", () => {
		expect(() => parseArgs([])).toThrow(/command/i);
	});
});

describe("isValidRegistry", () => {
	it("accepts a well-formed registry", () => {
		expect(isValidRegistry({ version: 1, slots: { "/repo/wt-a": 1 } })).toBe(
			true,
		);
	});

	it("rejects null slots instead of passing the typeof-object check", () => {
		expect(isValidRegistry({ version: 1, slots: null })).toBe(false);
	});

	it("rejects an array in place of slots", () => {
		expect(isValidRegistry({ version: 1, slots: [] })).toBe(false);
	});

	it("rejects slot values that are not integers >= 1", () => {
		expect(isValidRegistry({ version: 1, slots: { "/repo/wt-a": 0 } })).toBe(
			false,
		);
		expect(isValidRegistry({ version: 1, slots: { "/repo/wt-a": 1.5 } })).toBe(
			false,
		);
	});

	it("rejects a mismatched version", () => {
		expect(isValidRegistry({ version: 2, slots: {} })).toBe(false);
	});

	it("rejects non-object input", () => {
		expect(isValidRegistry(null)).toBe(false);
		expect(isValidRegistry("nope")).toBe(false);
	});
});

describe("committed env templates", () => {
	/**
	 * applySlotPorts rewrites only exact `localhost:<base>` occurrences and the
	 * bare `PORT=3000` line, while the preflight compares ports numerically.
	 * These are two independent notions of "slot-correct"; this pins the real
	 * templates to both so a template edit cannot silently break fresh-worktree
	 * setup at slot >= 1.
	 */
	const template = (path: string) =>
		readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

	it("server template regenerates cleanly for a non-zero slot", () => {
		const ports = portsForSlot(1);
		const generated = applySlotPorts(
			template("apps/server/.env.example"),
			ports,
		);
		expect(envPortMismatches(generated, ports, SERVER_ENV_PORT_KEYS)).toEqual(
			[],
		);
	});

	it("web template regenerates cleanly for a non-zero slot", () => {
		const ports = portsForSlot(1);
		const generated = applySlotPorts(template("apps/web/.env.example"), ports);
		expect(envPortMismatches(generated, ports, WEB_ENV_PORT_KEYS)).toEqual([]);
	});
});
