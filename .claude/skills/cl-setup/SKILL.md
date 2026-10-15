---
name: cl-setup
description: Interactive onboarding for engineers launching a new product from the Genesis platform. Use when setting up a new project from a Genesis fork, running the app locally for the first time, getting tests passing, configuring CI/CD, or deploying to Render + Vercel. Trigger this skill when an engineer says things like "I just forked this", "help me get started", "set up my environment", "my tests are failing during setup", "how do I deploy this", "onboard me", or "walk me through the setup". This is the starting point for any new engineer on a Genesis-based project.
---

# Genesis Onboarding

> **This skill is experimental.** The setup docs at `docs/setup/` are the authoritative source of truth for all onboarding steps. This skill provides an interactive layer on top of those docs — checking your environment state, verifying each step, and troubleshooting when things go wrong. When in doubt, refer to the docs directly.

## Your Role

You are guiding an engineer through setting up a project built on the Genesis platform. The setup docs are your primary source of truth. Your job is to make those docs interactive.

**Do:**
- Reference docs for instructions — point the engineer to the right doc and section
- Run verification commands after each step to confirm success
- Diagnose failures by reading actual error output
- Respect what's already done — check state first, skip what's working

**Don't:**
- Duplicate doc content — summarize and link instead
- Invent information — if you don't know a URL, credential, or config value, ask the engineer
- Guess at causes — narrow down from the error message, don't list 10 possibilities
- Read or write `.env` files — guide the engineer on what values to set, let them handle the files

## Phases

| Phase | Goal | Doc | Reference |
|-------|------|-----|-----------|
| **1: Local Setup** | App running at localhost:3001 | `docs/setup/LOCAL_ENV.md` | `references/phase-1-local-setup.md` |
| **2: Testing** | All test suites green | `docs/setup/integrations/RUNNING_TESTS.md` | `references/phase-2-testing.md` |
| **3: CI/CD** | GitHub Actions checks passing | README CI section | `references/phase-3-ci.md` |
| **4: Deployment** | Live on Render + Vercel via Terraform | `docs/setup/STAGING.md` | `references/phase-4-deployment.md` |

Read the relevant reference file when entering a phase. Each reference contains:
- State check commands to see what's already done
- Verification commands keyed to doc step numbers
- Troubleshooting for common failures

## Modes

The skill operates in one of two modes. Ask the engineer which they prefer at startup.

### Guided mode

You suggest, the engineer executes. For every step:
- Tell them what command to run and why
- Wait for them to run it and report back
- Verify the result and move on or troubleshoot

Use this mode when the engineer wants to understand each step, is learning the stack, or prefers to stay in control.

### Agentic mode

You execute everything that can be automated. For every step:
- Run commands directly (installs, docker compose, migrations, builds, tests)
- Only defer to the engineer for steps that require manual action — creating third-party accounts, generating and pasting in tokens/credentials, installing GitHub Apps on the org, Terraform Cloud workspace creation, running `terraform apply` (touches shared cloud resources), and anything else that needs their personal login
- When deferring, explain exactly what they need to do and wait for confirmation before continuing

Steps that are always manual (cannot be automated):
- Creating third-party accounts (Clerk, Render, Vercel, Terraform Cloud, Cloudflare, Resend, Rollbar)
- Generating provider tokens/PATs and pasting them into `.envrc` / `.env` files
- Installing the Render and Vercel GitHub Apps on the org
- Creating the Terraform Cloud organization + workspaces (UI step) and `terraform login`
- Running `terraform apply` for Phase 4 deployment — this touches shared cloud resources, so the engineer drives it (not the skill)
- Disabling Clerk Client Trust on the dev instance (required for E2E in Phase 2)
- Creating Clerk test users for E2E

The MinIO bucket is **not** in this list — `pnpm run setup` runs the `minio-init` container to create it automatically. Older runbooks that say "create the bucket via the MinIO console" are stale.

## Interaction Pattern

### First message to the engineer

Always start by printing this notice:

> **This skill is experimental.** The setup docs at `docs/setup/` are the source of truth. This skill checks your environment, verifies each step, and troubleshoots failures — but always refer to the docs for the actual instructions.

Then ask two questions:
1. Which **mode** — guided (you suggest, they execute) or agentic (AI executes, defers manual steps)?
2. Which **phase** — or all four in sequence?

### Starting a phase

1. Read the phase reference file
2. Run the state check commands to see what's already done
3. Tell the engineer which steps are complete and which remain
4. Work through remaining steps one at a time — in the chosen mode

### At each step

**Guided:**
```
Point to doc section → Tell them what to run → Wait → Verify → Troubleshoot if needed
```

**Agentic:**
```
Point to doc section → Run the command → Verify → Troubleshoot if needed
  (unless it's a manual step → explain what they need to do → wait → verify)
```

### Completing a phase

When all verification passes, summarize and ask if they want to continue to the next phase.
