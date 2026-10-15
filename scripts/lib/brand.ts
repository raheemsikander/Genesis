/**
 * brand.ts
 *
 * Pure, I/O-free core for the project rename + brand-leakage guard.
 * `scripts/rename.ts` and `scripts/check-brand.ts` do the file I/O and
 * prompting; everything here is deterministic and unit-tested against
 * fixtures. Do NOT import fs / glob / zx / process here.
 */

export type Change = { path: string; search: RegExp; replace: string };

export type BrandInputs = {
	name: string;
	displayName: string;
	notionDbUrl: string;
	repoUrl: string;
};

const DISPLAY_NAME_ALLOWED = /^[A-Za-z0-9 .,&-]+$/;

export const SLUG_PATTERN = /^[a-z][a-z0-9]*$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 20;

/** Format + length check for a project slug (not the "is it genesis?" guard). */
export function isValidSlug(name: string): boolean {
	return (
		SLUG_PATTERN.test(name) &&
		name.length >= SLUG_MIN_LENGTH &&
		name.length <= SLUG_MAX_LENGTH
	);
}

export function capitalizeSlug(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1);
}

export function validateDisplayName(name: string): void {
	if (!DISPLAY_NAME_ALLOWED.test(name)) {
		throw new Error(
			`"${name}" is not a valid display name. Use letters, digits, spaces, and . , & - only.`,
		);
	}
}

export function deriveBundleId(name: string): string {
	return `com.${name}.mobile`;
}

/** The entered display name, or the capitalized slug when left blank. */
export function resolveDisplayName(raw: string, slug: string): string {
	return raw.trim() || capitalizeSlug(slug);
}

/** Blank (means "clear") or a notion.so / notion.site URL. */
export function isValidNotionUrl(url: string): boolean {
	const value = url.trim();
	return (
		value.length === 0 ||
		/^https:\/\/([a-z0-9-]+\.)?notion\.(so|site)\//i.test(value)
	);
}

/**
 * The full brand rewrite set: the legacy infra/config allowlist (package name,
 * docker-compose, render.yaml, terraform) plus the user-facing brand targets
 * (mobile bundle ids, apollo databaseUrl, web UI + email copy, Clerk-coupled
 * E2E asserts). Doc-glob rewrites stay in rename.ts (they need the filesystem).
 */
export function buildBrandChanges({
	name,
	displayName,
	notionDbUrl,
	repoUrl,
}: BrandInputs): Change[] {
	const githubOwner = repoUrl
		? (repoUrl.replace(/^https:\/\/github\.com\//, "").split("/")[0] ?? "")
		: "";

	const changes: Change[] = [
		{
			path: "package.json",
			search: /"name":\s*"genesis"/g,
			replace: `"name": "${name}"`,
		},

		{
			path: "docker-compose.yml",
			search: /(\bPOSTGRES_(?:USER|PASSWORD|DB):\s*)genesis\b/g,
			replace: `$1${name}`,
		},
		{
			path: "docker-compose.yml",
			search: /(\bMINIO_ROOT_USER:\s*)genesis\b/g,
			replace: `$1${name}`,
		},
		{
			path: "docker-compose.yml",
			search: /(\bMINIO_ROOT_PASSWORD:\s*)genesis(\d+)/g,
			replace: `$1${name}$2`,
		},
		{
			path: "docker-compose.yml",
			search: /pg_isready -U genesis -d genesis/g,
			replace: `pg_isready -U ${name} -d ${name}`,
		},
		{
			path: "docker-compose.yml",
			search: /postgresql:\/\/genesis:genesis@localhost:5433\/genesis/g,
			replace: `postgresql://${name}:${name}@localhost:5433/${name}`,
		},
		{
			path: "docker-compose.yml",
			search: /username: genesis, password: genesis123/g,
			replace: `username: ${name}, password: ${name}123`,
		},

		{
			path: "docker-compose.test.yml",
			search: /\bgenesis-test-(db|minio)\b/g,
			replace: `${name}-test-$1`,
		},
		{
			path: "docker-compose.test.yml",
			search: /\bgenesis_test\b/g,
			replace: `${name}_test`,
		},

		// render.yaml lives under docs/setup/manual/ as a legacy reference for
		// teams that haven't adopted the Terraform flow. We also check the
		// repo root in case a user opted into the manual flow and copied the
		// file out — readIfExists silently skips whichever path is missing.
		...["docs/setup/manual/render.yaml", "render.yaml"].flatMap(
			(renderYamlPath): Change[] => [
				{
					path: renderYamlPath,
					search: /\bgenesis-/g,
					replace: `${name}-`,
				},
				{
					path: renderYamlPath,
					// Matches `name: genesis`, `- name: genesis` (list item), and
					// `#  name: genesis` (commented-out prod block) for `name`,
					// `databaseName`, and `user`.
					search: /(^\s*(?:[#-]\s*)?(?:name|databaseName|user):\s*)genesis\b/gm,
					replace: `$1${name}`,
				},
			],
		),

		// Order matters: `genesis_test` and `genesis123` first because \bgenesis\b doesn't cross word chars.
		{
			path: "apps/server/.env.example",
			search: /\bgenesis_test\b/g,
			replace: `${name}_test`,
		},
		{
			path: "apps/server/.env.example",
			search: /\bgenesis(\d+)/g,
			replace: `${name}$1`,
		},
		{ path: "apps/server/.env.example", search: /\bgenesis\b/g, replace: name },

		{
			path: "apps/web/.env.example",
			search: /@genesis\.com\b/g,
			replace: `@${name}.com`,
		},

		{
			path: ".github/workflows/server-tests.yml",
			search: /\bgenesis_test\b/g,
			replace: `${name}_test`,
		},

		// Terraform — project_name + workspace names (derivable from `name`,
		// always applied). project_name lives in the per-env tfvars (used as a
		// naming prefix for env-scoped resources) AND in shared/tfvars (the
		// vercel/render project name). Workspace names are <project>-<env>
		// for the three TFC workspaces (staging, production, shared).
		{
			path: "infra/terraform/envs/staging/terraform.tfvars",
			search: /(project_name\s*=\s*")genesis(")/g,
			replace: `$1${name}$2`,
		},
		{
			path: "infra/terraform/envs/production/terraform.tfvars",
			search: /(project_name\s*=\s*")genesis(")/g,
			replace: `$1${name}$2`,
		},
		{
			path: "infra/terraform/envs/shared/terraform.tfvars",
			search: /(project_name\s*=\s*")genesis(")/g,
			replace: `$1${name}$2`,
		},
		{
			path: "infra/terraform/envs/staging/backend.tf",
			search: /(name\s*=\s*")genesis(-staging")/g,
			replace: `$1${name}$2`,
		},
		{
			path: "infra/terraform/envs/production/backend.tf",
			search: /(name\s*=\s*")genesis(-production")/g,
			replace: `$1${name}$2`,
		},
		{
			path: "infra/terraform/envs/shared/backend.tf",
			search: /(name\s*=\s*")genesis(-shared")/g,
			replace: `$1${name}$2`,
		},
		// Per-env main.tf carries the shared workspace name in its
		// terraform_remote_state config — must match shared/backend.tf.
		{
			path: "infra/terraform/envs/staging/main.tf",
			search: /(name\s*=\s*")genesis(-shared")/g,
			replace: `$1${name}$2`,
		},
		{
			path: "infra/terraform/envs/production/main.tf",
			search: /(name\s*=\s*")genesis(-shared")/g,
			replace: `$1${name}$2`,
		},

		// TFC organization — defaults to the project name. The common case is a
		// one-product fork where the TFC org slug matches the project name. Forks
		// whose org slug differs edit `backend.tf` manually before `terraform apply`.
		{
			path: "infra/terraform/envs/staging/backend.tf",
			search: /(organization\s*=\s*")project-genesis(")/g,
			replace: `$1${name}$2`,
		},
		{
			path: "infra/terraform/envs/production/backend.tf",
			search: /(organization\s*=\s*")project-genesis(")/g,
			replace: `$1${name}$2`,
		},
		{
			path: "infra/terraform/envs/shared/backend.tf",
			search: /(organization\s*=\s*")project-genesis(")/g,
			replace: `$1${name}$2`,
		},
		// Per-env main.tf also carries the org name in terraform_remote_state.
		{
			path: "infra/terraform/envs/staging/main.tf",
			search: /(organization\s*=\s*")project-genesis(")/g,
			replace: `$1${name}$2`,
		},
		{
			path: "infra/terraform/envs/production/main.tf",
			search: /(organization\s*=\s*")project-genesis(")/g,
			replace: `$1${name}$2`,
		},

		// ─── Brand-leakage targets (user-facing) ──────────────────────────────

		// Mobile bundle ids + Maestro appId — org-scoped, so replace the whole
		// reverse-DNS id with com.<name>.mobile.
		{
			path: "apps/mobile/app.json",
			search: /com\.conradlabs\.mobile/g,
			replace: deriveBundleId(name),
		},
		{
			path: "apps/mobile/e2e/flows/smoke/app-launch.yaml",
			search: /com\.conradlabs\.mobile/g,
			replace: deriveBundleId(name),
		},

		// apollo tooling — rewrite the Notion databaseUrl value only (blank
		// clears it, forcing cl-init rather than misrouting to the origin
		// board). $schema is deliberately NOT touched: it references the shared
		// apollo plugin repo and is correct for any fork still using apollo.
		{
			path: ".claude/apollo.json",
			search: /("databaseUrl":\s*")[^"]*(")/g,
			replace: `$1${notionDbUrl}$2`,
		},
		// The branchFormat example carries the origin slug (e.g.
		// "genesis-150-automate-render-terraform"). Rewrite its prefix to the
		// new slug so the example matches a fork's own branch names.
		{
			path: ".claude/apollo.json",
			search: /("example":\s*")genesis(-)/g,
			replace: `$1${name}$2`,
		},

		// Web UI + email brand copy. `Project Genesis` MUST come before the bare
		// `Genesis` per file so the longer phrase isn't partially consumed
		// (applyFileChanges runs on a shrinking buffer, so array order wins).
		{
			path: "apps/web/src/app/portal/email/page.tsx",
			search: /Project Genesis/g,
			replace: displayName,
		},
		{
			path: "apps/server/src/email/components/email-layout.tsx",
			search: /Project Genesis/g,
			replace: displayName,
		},
		{
			path: "apps/server/src/email/templates/invite.template.tsx",
			search: /Project Genesis/g,
			replace: displayName,
		},
		{
			path: "packages/shared/src/models/email-template.types.ts",
			search: /Project Genesis/g,
			replace: displayName,
		},
		{
			path: "apps/web/src/app/layout.tsx",
			search: /"Genesis"/g,
			replace: `"${displayName}"`,
		},
		{
			path: "apps/web/src/app/page.tsx",
			search: /\bGenesis\b/g,
			replace: displayName,
		},
		{
			path: "apps/web/src/components/app-sidebar.tsx",
			search: /\? "Genesis" : "G"/g,
			replace: `? "${displayName}" : "${displayName.charAt(0)}"`,
		},

		// Clerk-coupled E2E asserts. The heading is served by the Clerk
		// dashboard app name — rewriting the assert keeps CI green ONLY if the
		// operator renames their Clerk app to the display name in lockstep
		// (documented as a manual step).
		{
			path: "apps/web/e2e/auth.test.ts",
			search: /Sign in to Genesis/g,
			replace: `Sign in to ${displayName}`,
		},
		{
			path: "apps/web/e2e/portal.test.ts",
			search: /Sign in to Genesis/g,
			replace: `Sign in to ${displayName}`,
		},
	];

	// Repo URL — only if provided. Updates the shared tfvars (single source of
	// truth for repo_url) + the matching GITHUB_OWNER line in per-env
	// .envrc.example files (per-env, since GitHub secrets are env-scoped).
	if (repoUrl) {
		changes.push(
			{
				path: "infra/terraform/envs/shared/terraform.tfvars",
				search: /(repo_url\s*=\s*")[^"]+(")/g,
				replace: `$1${repoUrl}$2`,
			},
			{
				path: "infra/terraform/envs/shared/.envrc.example",
				search: /(GITHUB_OWNER=")Conrad-Labs(")/g,
				replace: `$1${githubOwner}$2`,
			},
			{
				path: "infra/terraform/envs/staging/.envrc.example",
				search: /(GITHUB_OWNER=")Conrad-Labs(")/g,
				replace: `$1${githubOwner}$2`,
			},
			{
				path: "infra/terraform/envs/production/.envrc.example",
				search: /(GITHUB_OWNER=")Conrad-Labs(")/g,
				replace: `$1${githubOwner}$2`,
			},
		);
	}

	return changes;
}

/** Origin-org tokens the guard treats as brand leakage. */
export const ORIGIN_TOKENS = /genesis|conrad-?labs|project-genesis/gi;

/**
 * Files the `check-brand` guard scans for residual origin tokens after a
 * rename. Scoped to the user-facing brand targets (not docs, not migrations)
 * to stay low-false-positive.
 */
export const BRAND_SENSITIVE_FILES = [
	"apps/mobile/app.json",
	"apps/mobile/e2e/flows/smoke/app-launch.yaml",
	".claude/apollo.json",
	"apps/web/src/app/layout.tsx",
	"apps/web/src/app/page.tsx",
	"apps/web/src/components/app-sidebar.tsx",
	"apps/web/src/app/portal/email/page.tsx",
	"apps/server/src/email/components/email-layout.tsx",
	"apps/server/src/email/templates/invite.template.tsx",
	"packages/shared/src/models/email-template.types.ts",
	"apps/web/e2e/auth.test.ts",
	"apps/web/e2e/portal.test.ts",
];

export type Leak = { path: string; line: number; token: string };

/**
 * Report every origin token remaining in the given files, with file + line.
 * `$schema` lines are skipped: apollo's schema ref legitimately keeps the
 * origin org (it points at the shared apollo plugin repo).
 */
export function scanForBrandLeakage(
	files: { path: string; content: string }[],
): Leak[] {
	const leaks: Leak[] = [];
	for (const { path, content } of files) {
		content.split("\n").forEach((lineText, i) => {
			if (lineText.includes('"$schema"')) return;
			for (const m of lineText.matchAll(ORIGIN_TOKENS)) {
				leaks.push({ path, line: i + 1, token: m[0] });
			}
		});
	}
	return leaks;
}

/** The repo is unrenamed while package.json still carries the placeholder. */
export function isUnrenamed(pkgName: string): boolean {
	return pkgName === "genesis";
}

/**
 * Apply each regex to a shrinking buffer so later regexes can't re-count
 * matches that earlier ones have already rewritten (the double-count that
 * happened when multiple regexes targeted the same occurrence).
 */
export function applyFileChanges(
	content: string,
	fileChanges: Change[],
): { modified: string; occurrences: number } {
	let modified = content;
	let occurrences = 0;
	for (const change of fileChanges) {
		const matches = modified.match(change.search);
		if (matches && matches.length > 0) {
			occurrences += matches.length;
			modified = modified.replace(change.search, change.replace);
		}
	}
	return { modified, occurrences };
}
