#!/usr/bin/env zx
/**
 * check-brand.ts
 *
 * Guard a fork wires into its own CI/deploy to catch a repo that still carries
 * the origin's branding. Two checks:
 *   1. package.json name is still "genesis" → the repo was never renamed.
 *   2. Otherwise, scan the brand-sensitive files for residual origin tokens.
 *
 * Manual / opt-in only — NOT part of `pnpm check` and NOT wired into the
 * origin platform's pipeline. On the origin repo (legitimately "genesis") this
 * exits 1 by design; that is the correct answer, not a false positive.
 *
 * Usage:  pnpm check-brand
 * Exit:   0 clean · 1 unrenamed or residual leakage found
 */

import { fs } from "zx";
import {
	BRAND_SENSITIVE_FILES,
	isUnrenamed,
	scanForBrandLeakage,
} from "./lib/brand.ts";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
	name: string;
};

if (isUnrenamed(pkg.name)) {
	console.error(
		'✗ Repo is still named "genesis" — run `pnpm rename <name>` before deploying.',
	);
	process.exit(1);
}

const files = BRAND_SENSITIVE_FILES.flatMap((path) => {
	try {
		return [{ path, content: fs.readFileSync(path, "utf8") }];
	} catch {
		return [];
	}
});

const leaks = scanForBrandLeakage(files);

if (leaks.length > 0) {
	console.error("✗ Residual origin-brand strings found:");
	for (const leak of leaks) {
		console.error(`  ${leak.path}:${leak.line}  ${leak.token}`);
	}
	process.exit(1);
}

console.log("✓ No origin-brand leakage detected.");
