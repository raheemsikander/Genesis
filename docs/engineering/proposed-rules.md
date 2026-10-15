# Proposed Rules

Rules and conventions discovered during development that should be reviewed before adding to CLAUDE.md.

<!-- Add new entries below. Format: - **Rule:** <description> — **Context:** <why this came up> -->

- **Rule:** Avoid incidental Genesis mentions in comments, doc headers, example values, or ticket refs when generic phrasing works. Intentional deployment resources (render.yaml services, docker creds, setup-doc URLs) that use the placeholder name are fine — just run `pnpm rename testname` against a clean tree and confirm the new reference shows up in the preview before committing. — **Context:** GENESIS-146. The rename script handles intentional deployment refs cleanly; it's the incidental ones (Genesis 2.0 headers, stale Notion IDs, Conrad-Labs-specific URL examples) that create pointless rename work for forking MVPs.
