#!/usr/bin/env bash
# Build Next.js with source maps, upload them to Rollbar, then remove
# the .map files so they are never served publicly.
#
# Required env vars (set in Vercel dashboard):
#   ROLLBAR_CLIENT_SOURCEMAP_TOKEN — Rollbar write access token (source maps scope)
#   DEPLOY_URL                     — Frontend URL of the deployed app
#
# Provided automatically by Vercel:
#   VERCEL_GIT_COMMIT_SHA — the deployed commit hash

set -euo pipefail

# 1. Build with source maps
GENERATE_SOURCEMAPS=true next build --webpack

# 2. Upload source maps to Rollbar (skip if token not set)
if [[ -n "${ROLLBAR_CLIENT_SOURCEMAP_TOKEN:-}" && -n "${DEPLOY_URL:-}" ]]; then
	echo "Uploading source maps to Rollbar..."
	npx rollbar-cli@0.2.1 upload-sourcemaps .next/static/chunks \
		--access-token "$ROLLBAR_CLIENT_SOURCEMAP_TOKEN" \
		--url-prefix "$DEPLOY_URL/_next/static/chunks/" \
		--code-version "${VERCEL_GIT_COMMIT_SHA:-development}"
	echo "Source maps uploaded."
else
	echo "Skipping source map upload (ROLLBAR_CLIENT_SOURCEMAP_TOKEN or DEPLOY_URL not set)."
fi

# 3. Remove .map files so they are not publicly accessible
find .next -name '*.map' -delete
echo "Source map files removed from build output."
