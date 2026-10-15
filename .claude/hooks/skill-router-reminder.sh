#!/bin/bash
# Re-injects project skill routing rules into context at session start.
# Without this, project skills lose to plugin skills (superpowers, agent-skills,
# apollo) that get reinforced on every session. This levels the playing field.

cat <<'EOF'
PROJECT SKILL ROUTING — invoke these BEFORE editing the relevant files.

Path rule wins. Examples in parens are illustrative, not a closed set.
Many tasks need MULTIPLE skills (e.g. integrating a service = env-var skill
+ backend/frontend skill + any service plugin skill). Invoke all that apply.

If the task touches…                              → invoke skill
─────────────────────────────────────────────────────────────────────
any new/renamed env var (backend OR frontend),
  apps/server/src/utils/env.ts, apps/web/src/utils/env.ts,
  or any .env.example file                          → cl-adding-environment-variable
apps/server/src/email/ or any transactional email   → cl-adding-email-template
ANY file under apps/server/ (controllers, services,
  utils, monitoring, integrations, jobs, etc.)      → cl-backend-patterns
ANY file under apps/web/ (pages, components, hooks,
  providers, utils, client monitoring, etc.)        → cl-frontend-patterns
ANY file under packages/ui/, OR any mobile/
  responsive work anywhere in apps/web/ (components,
  tokens, styles, theme, breakpoints, viewport,
  touch targets)                                    → cl-design-agent
ANY file under packages/shared/ (Zod schemas,
  validation, shared types, error shapes)           → cl-error-handling
first-time setup, onboarding, deploy config         → cl-setup

Project skills override generic plugin skills (incremental-implementation,
brainstorming, api-and-interface-design, etc.) when both could apply. If
you're about to edit a file in the paths above without invoking the matching
project skill first — STOP and invoke it. When in doubt, invoke it: skill
calls are cheap, missing required steps is expensive.
EOF
