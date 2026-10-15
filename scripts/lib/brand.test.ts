import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	applyFileChanges,
	BRAND_SENSITIVE_FILES,
	buildBrandChanges,
	capitalizeSlug,
	deriveBundleId,
	isUnrenamed,
	isValidNotionUrl,
	isValidSlug,
	resolveDisplayName,
	scanForBrandLeakage,
	validateDisplayName,
} from "./brand";

const INPUTS = {
	name: "acme",
	displayName: "Acme",
	notionDbUrl: "",
	repoUrl: "",
};
const changesFor = (path: string) =>
	buildBrandChanges(INPUTS).filter((c) => c.path === path);
const applyTo = (path: string, src: string, inputs = INPUTS) =>
	applyFileChanges(
		src,
		buildBrandChanges(inputs).filter((c) => c.path === path),
	).modified;

describe("buildBrandChanges — new brand targets", () => {
	it("rewrites mobile bundle ids", () => {
		const src = `"bundleIdentifier": "com.conradlabs.mobile"\n"package": "com.conradlabs.mobile"`;
		const modified = applyTo("apps/mobile/app.json", src);
		expect(modified).not.toMatch(/conradlabs/);
		expect(modified.match(/com\.acme\.mobile/g)).toHaveLength(2);
	});

	it("rewrites the maestro appId", () => {
		const modified = applyTo(
			"apps/mobile/e2e/flows/smoke/app-launch.yaml",
			"appId: com.conradlabs.mobile",
		);
		expect(modified).toBe("appId: com.acme.mobile");
	});

	it("clears apollo databaseUrl when notionDbUrl is blank", () => {
		const src = `"databaseUrl": "https://www.notion.so/328512441d3c81d5931ff1faee28ddd8"`;
		expect(applyTo(".claude/apollo.json", src)).toBe(`"databaseUrl": ""`);
	});

	it("sets apollo databaseUrl when provided", () => {
		const src = `"databaseUrl": "https://www.notion.so/328512441d3c81d5931ff1faee28ddd8"`;
		const modified = applyTo(".claude/apollo.json", src, {
			...INPUTS,
			notionDbUrl: "https://www.notion.so/abc123",
		});
		expect(modified).toBe(`"databaseUrl": "https://www.notion.so/abc123"`);
	});

	it("rewrites the apollo branchFormat example slug", () => {
		const src = `"example": "genesis-150-automate-render-terraform"`;
		expect(applyTo(".claude/apollo.json", src)).toBe(
			`"example": "acme-150-automate-render-terraform"`,
		);
	});

	it("leaves the apollo $schema untouched", () => {
		const src = `"$schema": "https://raw.githubusercontent.com/Conrad-Labs/olympus/main/schemas/config.v1.json"`;
		expect(applyTo(".claude/apollo.json", src)).toBe(src);
	});

	it("rewrites layout title + description", () => {
		const src = `title: "Genesis",\n\tdescription: "Genesis",`;
		const modified = applyTo("apps/web/src/app/layout.tsx", src);
		expect(modified).toBe(`title: "Acme",\n\tdescription: "Acme",`);
	});

	it("rewrites the landing header + footer copy", () => {
		const src = "Genesis\n&copy; {year} Genesis. All rights reserved.";
		const modified = applyTo("apps/web/src/app/page.tsx", src);
		expect(modified).not.toMatch(/Genesis/);
		expect(modified).toContain("&copy; {year} Acme.");
	});

	it("rewrites the sidebar label and collapsed letter", () => {
		const modified = applyTo(
			"apps/web/src/components/app-sidebar.tsx",
			`{showFull ? "Genesis" : "G"}`,
		);
		expect(modified).toBe(`{showFull ? "Acme" : "A"}`);
	});

	it("rewrites Project Genesis in the email subject", () => {
		const modified = applyTo(
			"packages/shared/src/models/email-template.types.ts",
			"`${data.inviterName} invited you to Project Genesis`",
		);
		expect(modified).toContain("invited you to Acme");
		expect(modified).not.toMatch(/Genesis/);
	});

	it.each([
		"apps/web/src/app/portal/email/page.tsx",
		"apps/server/src/email/components/email-layout.tsx",
		"apps/server/src/email/templates/invite.template.tsx",
	])("rewrites Project Genesis in %s", (path) => {
		expect(applyTo(path, "join Project Genesis.")).toBe("join Acme.");
	});

	it.each([
		"apps/web/e2e/auth.test.ts",
		"apps/web/e2e/portal.test.ts",
	])("rewrites the Clerk-coupled assert in %s", (path) => {
		expect(applyTo(path, `name: "Sign in to Genesis"`)).toBe(
			`name: "Sign in to Acme"`,
		);
	});
});

describe("buildBrandChanges — migrated legacy coverage (regression)", () => {
	const REPO = {
		name: "acme",
		displayName: "Acme",
		notionDbUrl: "",
		repoUrl: "https://github.com/acme-org/acme-app",
	};
	const applyRepo = (path: string, src: string) =>
		applyFileChanges(
			src,
			buildBrandChanges(REPO).filter((c) => c.path === path),
		).modified;

	it("rewrites the package name", () => {
		expect(applyRepo("package.json", `"name": "genesis"`)).toBe(
			`"name": "acme"`,
		);
	});

	it("rewrites docker-compose postgres creds + url", () => {
		const src =
			"POSTGRES_USER: genesis\npostgresql://genesis:genesis@localhost:5433/genesis";
		const modified = applyRepo("docker-compose.yml", src);
		expect(modified).not.toMatch(/genesis/);
		expect(modified).toContain("POSTGRES_USER: acme");
		expect(modified).toContain("postgresql://acme:acme@localhost:5433/acme");
	});

	it("rewrites the e2e test-user domain", () => {
		expect(
			applyRepo("apps/web/.env.example", "E2E=e2e-testing@genesis.com"),
		).toContain("@acme.com");
	});

	it("rewrites terraform project_name", () => {
		expect(
			applyRepo(
				"infra/terraform/envs/shared/terraform.tfvars",
				'project_name = "genesis"',
			),
		).toBe('project_name = "acme"');
	});

	it("rewrites terraform repo_url from the provided url", () => {
		expect(
			applyRepo(
				"infra/terraform/envs/shared/terraform.tfvars",
				'repo_url     = "https://github.com/Conrad-Labs/project-genesis-2.0"',
			),
		).toContain("https://github.com/acme-org/acme-app");
	});

	it("rewrites GITHUB_OWNER from the repo url owner", () => {
		expect(
			applyRepo(
				"infra/terraform/envs/shared/.envrc.example",
				'export GITHUB_OWNER="Conrad-Labs"      # repo owner',
			),
		).toContain('GITHUB_OWNER="acme-org"');
	});

	it("leaves GITHUB_OWNER alone when no repo url is given", () => {
		const changes = buildBrandChanges({ ...REPO, repoUrl: "" }).filter(
			(c) => c.path === "infra/terraform/envs/shared/.envrc.example",
		);
		expect(changes).toHaveLength(0);
	});
});

/**
 * Regression guard against silent drift: the change-set is built from regexes
 * that must match the REAL current file contents. A reformat of any target
 * file (e.g. Biome re-quoting the sidebar ternary) would defeat a rewrite with
 * every synthetic test still green — this catches that by running the actual
 * change-set against the files on disk. Runs from the repo root (vitest cwd).
 */
describe("buildBrandChanges against the real repo files", () => {
	const INPUTS = {
		name: "acme",
		displayName: "Acme Corp",
		notionDbUrl: "",
		repoUrl: "https://github.com/acme-org/acme-app",
	};
	const readReal = (path: string): string | null => {
		try {
			return readFileSync(path, "utf8");
		} catch {
			return null;
		}
	};

	it.each(
		BRAND_SENSITIVE_FILES,
	)("rewrites %s with no residual origin token", (path) => {
		const src = readReal(path);
		if (src === null) return; // trimmed fork may omit a target
		const changes = buildBrandChanges(INPUTS).filter((c) => c.path === path);
		const { modified, occurrences } = applyFileChanges(src, changes);
		expect(occurrences).toBeGreaterThan(0);
		const residual = scanForBrandLeakage([{ path, content: modified }]);
		expect(residual).toEqual([]);
	});
});

describe("applyFileChanges", () => {
	it("counts occurrences and is idempotent on re-run", () => {
		const changes = changesFor("apps/mobile/app.json");
		const first = applyFileChanges(`"x": "com.conradlabs.mobile"`, changes);
		expect(first.occurrences).toBe(1);
		const second = applyFileChanges(first.modified, changes);
		expect(second.occurrences).toBe(0);
		expect(second.modified).toBe(first.modified);
	});
});

describe("scanForBrandLeakage", () => {
	it("flags residual origin tokens with file + line", () => {
		const leaks = scanForBrandLeakage([
			{
				path: "apps/web/src/app/layout.tsx",
				content: 'ok: true\ntitle: "Genesis"',
			},
		]);
		expect(leaks).toEqual([
			{ path: "apps/web/src/app/layout.tsx", line: 2, token: "Genesis" },
		]);
	});

	it("catches conradlabs and project-genesis too", () => {
		const leaks = scanForBrandLeakage([
			{ path: "a", content: "com.conradlabs.mobile" },
			{ path: "b", content: "organization = project-genesis" },
		]);
		expect(leaks.map((l) => l.path)).toEqual(["a", "b"]);
	});

	it("returns [] for clean content", () => {
		expect(
			scanForBrandLeakage([{ path: "x", content: 'title: "Acme"' }]),
		).toEqual([]);
	});

	it("ignores a $schema line so the apollo schema ref is not a false positive", () => {
		const leaks = scanForBrandLeakage([
			{
				path: ".claude/apollo.json",
				content:
					'\t"$schema": "https://raw.githubusercontent.com/Conrad-Labs/olympus/main/schemas/config.v1.json",',
			},
		]);
		expect(leaks).toEqual([]);
	});
});

describe("BRAND_SENSITIVE_FILES", () => {
	it("includes the mobile, apollo, web, email, and e2e targets", () => {
		expect(BRAND_SENSITIVE_FILES).toEqual(
			expect.arrayContaining([
				"apps/mobile/app.json",
				"apps/mobile/e2e/flows/smoke/app-launch.yaml",
				".claude/apollo.json",
				"apps/web/src/app/layout.tsx",
				"packages/shared/src/models/email-template.types.ts",
				"apps/web/e2e/auth.test.ts",
			]),
		);
	});
});

describe("resolveDisplayName", () => {
	it("uses the entered value when present", () => {
		expect(resolveDisplayName("Acme Corp", "acme")).toBe("Acme Corp");
	});
	it("falls back to the capitalized slug when blank", () => {
		expect(resolveDisplayName("", "acme")).toBe("Acme");
		expect(resolveDisplayName("   ", "acme")).toBe("Acme");
	});
});

describe("isValidNotionUrl", () => {
	it("accepts blank (means clear) and notion.so / notion.site URLs", () => {
		expect(isValidNotionUrl("")).toBe(true);
		expect(isValidNotionUrl("https://www.notion.so/abc")).toBe(true);
		expect(isValidNotionUrl("https://notion.so/abc")).toBe(true);
		expect(isValidNotionUrl("https://acme.notion.site/abc")).toBe(true);
	});
	it("rejects non-notion URLs", () => {
		expect(isValidNotionUrl("https://example.com/abc")).toBe(false);
		expect(isValidNotionUrl("notion.so/abc")).toBe(false);
	});
});

describe("isValidSlug", () => {
	it("accepts lowercase alphanumeric names of length 3–20", () => {
		expect(isValidSlug("acme")).toBe(true);
		expect(isValidSlug("proj2")).toBe(true);
		expect(isValidSlug("abc")).toBe(true);
		expect(isValidSlug("a".repeat(20))).toBe(true);
	});
	it.each([
		["Acme", "uppercase"],
		["ac", "too short"],
		["a".repeat(21), "too long"],
		["my-app", "hyphen"],
		["my_app", "underscore"],
		["2fast", "leading digit"],
		["", "empty"],
	])("rejects %j (%s)", (bad) => {
		expect(isValidSlug(bad)).toBe(false);
	});
});

describe("isUnrenamed", () => {
	it("treats the genesis placeholder as unrenamed", () => {
		expect(isUnrenamed("genesis")).toBe(true);
		expect(isUnrenamed("acme")).toBe(false);
	});
});

describe("capitalizeSlug", () => {
	it("capitalizes the first letter", () => {
		expect(capitalizeSlug("acme")).toBe("Acme");
		expect(capitalizeSlug("proj2")).toBe("Proj2");
	});
});

describe("deriveBundleId", () => {
	it("builds a reverse-DNS bundle id from the slug", () => {
		expect(deriveBundleId("acme")).toBe("com.acme.mobile");
	});
});

describe("validateDisplayName", () => {
	it("accepts letters, digits, spaces, and . , & -", () => {
		expect(() => validateDisplayName("Acme")).not.toThrow();
		expect(() => validateDisplayName("Acme & Co.")).not.toThrow();
		expect(() => validateDisplayName("Acme.io")).not.toThrow();
	});
	it.each([
		'A"B',
		"A`B",
		"A{B}",
		"A<B>",
		"A\nB",
	])("rejects unsafe %j", (bad) => {
		expect(() => validateDisplayName(bad)).toThrow();
	});
});
