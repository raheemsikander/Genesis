# Alerting Strategy

## Summary (BLUF)

Rollbar is the alert bus, and **severity is the routing key**. Every server fault that is not an `ORPCError` with a status under 500 is reported to Rollbar at `warning`, `error`, or `critical`, carrying the ambient `requestId` (plus `jobId` and `queue` inside a job). Only `critical` in production pages a human; everything else lands in a chat channel.

Two things are needed to make this real:

1. **In this repo (done):** `apps/server/src/utils/alerting.ts` is the single reporting seam. `isAlertable` decides whether a fault is an incident, `reportAlert` tags it with a severity and attaches correlation context, and `flushAlerts` drains buffered reports before an intentional exit. Every fault-handling call site goes through it.
2. **In the Rollbar console (manual):** the five notification rules in [Notification rules to configure in Rollbar](#notification-rules-to-configure-in-rollbar). Rollbar rules cannot be expressed in this repo, so this document is the source of truth for them. Configure them once per project, then run the drill in [Verifying alerting works](#verifying-alerting-works).

Without step 2, faults are captured but nobody is told. Capture is not alerting.

## Signal inventory

Every fault we can detect, where it is detected, what severity it carries, where the notification goes, and who acts on it.

| Signal | Detected at | Severity | Channel | Who acts |
|---|---|---|---|---|
| oRPC handler throws an `ORPCError` with status >= 500 | `apps/server/src/orpc/error-interceptor.ts` (`handleRpcError`) | `error` | Rollbar production alerts channel | On-call backend engineer |
| oRPC handler throws an unexpected error (bare `Error`, non-`Error` value, third-party throw) | `apps/server/src/orpc/error-interceptor.ts` (`handleRpcError`) | `error` | Rollbar production alerts channel | On-call backend engineer |
| Unhandled error escaping Express on a non-oRPC route | `apps/server/src/index.ts` (the error-handling middleware) | `error` | Rollbar production alerts channel | On-call backend engineer |
| Uncaught exception / unhandled promise rejection | `apps/server/src/utils/rollbar.ts` (`captureUncaught`, `captureUnhandledRejections`, `uncaughtErrorLevel`) and `apps/server/src/utils/fatal-handlers.ts` | `critical` | Page, then the process exits 1 | On-call backend engineer |
| Background job exhausts its retries and is dead-lettered | `apps/server/src/async-tasks/job-runner.ts` (`createJobRunner`) | `critical` | Page | On-call backend engineer |
| Dead-letter enqueue fails (Redis unreachable) | `apps/server/src/async-tasks/job-runner.ts` (`deadLetter`) | `critical` | Page | On-call backend engineer |
| Worker-level error (queue connection lost, Redis dropped) | `apps/server/src/async-tasks/job-runner.ts` (`attachWorkerListeners`) | `error`, at most one report per worker per 5 minutes | Rollbar production alerts channel | On-call backend engineer |
| Scheduler registration fails at worker boot | `apps/server/src/async-tasks/worker.ts` (`registerSchedulers().catch`) | `critical` | Page | On-call backend engineer |
| Database health check fails | `apps/server/src/utils/health.ts` (`reportUnhealthyDependencies`) | `critical` | Page | On-call backend engineer |
| Redis or storage health check fails | `apps/server/src/utils/health.ts` (`reportUnhealthyDependencies`) | `error` | Rollbar production alerts channel | On-call backend engineer |
| Client-side JS error (render, event handler, route boundary) | `apps/web/src/providers/providers.tsx:37-58` (`RollbarProvider`) and the `app/**/error.tsx` boundaries | `error` | Rollbar production alerts channel (client project) | On-call frontend engineer |
| Non-essential client init failure (e.g. analytics) | `apps/web/src/utils/analytics.ts` (`rollbar.warning`) | `warning` | None, backlog review only | Whoever owns the integration |
| CI failure on `develop` or a PR | GitHub Actions (`.github/workflows/build.yml`, `lint.yml`, `server-tests.yml`, `web-tests.yml`) | n/a | GitHub Actions UI and the PR checks list | PR author |
| Deploy failure | `.github/workflows/deploy.yml:63-74` (non-2xx from the Render API fails the step) | n/a | GitHub Actions UI | Whoever merged |

The last two rows have no Rollbar path by design: they are build-time, not run-time, and GitHub already surfaces them on the PR. See [Known gaps and follow-ups](#known-gaps-and-follow-ups).

Server and client are separate Rollbar projects (`genesis-server-<env>`, `genesis-client-<env>`), so the rules below must be created in both.

## Severity taxonomy

| Level | Meaning | Response |
|---|---|---|
| `critical` | Work or data is permanently lost, or the process cannot serve | Page immediately |
| `error` | An unexpected server fault; the request failed | Triage same business day |
| `warning` | Degraded but still serving; non-essential functionality failed | Review in the backlog |

Severity is chosen at the call site and passed to `reportAlert`. The default is `error`, so a new call site that forgets to think about severity still gets triaged rather than paging or vanishing.

## Notification rules to configure in Rollbar

These live in the Rollbar console (**Project → Settings → Notifications**) because Rollbar notification rules have no representation in this repository. Create them in both the server and client projects.

| # | Condition | Action | Urgency |
|---|---|---|---|
| a | `level = critical` AND `environment = production` | Page the on-call engineer | Immediately |
| b | `level = error` AND `environment = production` AND item is new | Post to the production alerts channel | Immediately |
| c | `level = error` AND `environment = production` AND more than 25 occurrences in 5 minutes | Post to the production alerts channel | Immediately |
| d | Any item reactivated after being resolved | Post to the production alerts channel | Immediately |
| e | `environment = staging` AND `level` at or above `error` AND item is new | Post to the staging channel | No paging |

Rule (b) fires once per new fingerprint, so a single broken deploy produces one message per distinct fault rather than one per request. Rule (c) is what catches a fault that was already known but has started happening at a rate that matters. Rule (d) exists because a regression of something we already fixed is worth hearing about even when the item is not new.

If a specific fault turns out to be noisy, the fix is to model it correctly as a typed 4xx at the call site, not to loosen these rules.

## What we deliberately do not alert on

- **4xx client faults.** An `ORPCError` with a status under 500 is the API telling a caller it asked for the wrong thing. That is the contract working. `isAlertable` returns `false` for exactly this case, and the fault is logged at `warn` instead.
- **Retryable job attempts that still have retries left.** A job that fails and later succeeds is not an incident. Only the terminal failure, the one that reaches the dead-letter queue, alerts. This holds for jobs on the dead-letter queue itself: a failing dead-letter handler pages once, on its own last attempt, not once per retry.
- **Repeat worker-level errors inside a 5 minute window.** A Redis outage fires the worker `error` listener every few hundred milliseconds for its whole duration. One report stands in for the burst, because spending the tracker's rate limit on a single known incident is how the genuinely new items during that incident get dropped. Every one of them is still logged.
- **Health checks reported as `skipped`.** A dependency that is not configured in this environment is not a dependency that is down. Only a check with status `error` reports.
- **Anything in local or dev.** The Rollbar SDK is constructed with `enabled: !!ROLLBAR_SERVER_TOKEN` (`apps/server/src/utils/rollbar.ts:7`), so with no token every reporting path is a silent no-op. Nothing is sent, and nothing throws.

## From alert to root cause

Every **server** alert carries a `requestId`, and the same id appears in the server logs and in the Rollbar item. That is the join key.

1. **The client mints it.** `apps/web/src/utils/orpc.ts:12-19` generates a UUID per oRPC call and sends it as the `x-request-id` header. It also writes that value into the client-side Rollbar payload, but via the **global** `rollbar.configure`, so with concurrent oRPC calls in flight the last one wins process-wide. Treat a client item's `requestId` as best-effort: it points at one of the calls in flight, not necessarily the one that failed. Steps 2 to 5 are exact.
2. **The server validates and reuses it.** In `apps/server/src/index.ts`, pino's `genReqId` parses the incoming `x-request-id` as a UUID and reuses it when valid, generating a fresh one otherwise. It echoes the id back on the response header, then the next middleware opens an AsyncLocalStorage context holding it.
3. **Every log line carries it.** The pino `mixin` in `apps/server/src/utils/logger.ts:9-16` reads that context on each line and merges `requestId` (plus `jobId` and `queue` when the line comes from a worker) into the output. No call site has to remember to pass it.
4. **Every alert carries it.** `reportAlert` in `apps/server/src/utils/alerting.ts` reads the same context and attaches it as `custom.requestId` on the Rollbar item. Correlation fields are applied last, so a caller-supplied `context` key can never shadow them.
5. **The user can quote it.** The 500 response body from the Express error handler includes `requestId` (the error-handling middleware in `apps/server/src/index.ts`), so a report of "it broke" from a user can be turned into an exact log search.

So the workflow from an alert is: open the Rollbar item, read `custom.requestId`, and search the Render logs for that id to get the full request trace. Inside a job, search on `jobId` and `queue` instead.

## Known gaps and follow-ups

- **Rollbar identity and the client-side `requestId` are set globally, not per request.** `apps/server/src/index.ts` attaches the Clerk user with `rollbar.configure({ payload: { person } })` and `apps/web/src/utils/orpc.ts` does the same with `custom.requestId`. Both mutate one process-wide instance, so under concurrency an item can carry the wrong user or the wrong call's id. The server-side `custom.requestId` on every `reportAlert` item is unaffected: it is read from AsyncLocalStorage and is always the failing request's own. The fix is a request-scoped instance rather than global `configure`, and it is a follow-up.
- **Worker alerts will not fire in staging until the worker is deployed.** The Render worker deploy step in `.github/workflows/deploy.yml:76-93` is commented out, and enabling it also requires enabling the worker in Terraform. Until then, the job-failure, worker-error, and scheduler-registration signals exist in code but have no running process to emit them outside local development.
- **No external uptime monitor polls `/health/detailed`.** Render's health check points at `/health` (`infra/terraform/modules/render/variables.tf:86-88`), which is a static `{ ok: true }`. That is deliberate: Render restarts a service that fails its health check, and a restart cannot fix a third-party outage, so pointing Render at the dependency check would turn a Redis blip into a restart loop. The consequence is that `reportUnhealthyDependencies` only runs when something actually calls `/health/detailed`. An external monitor polling that path on an interval is the missing piece.
- **CI and deploy failures have no channel beyond the GitHub Actions UI.** A failed deploy is visible on the commit and in the Actions tab, and nowhere else. Routing the `deploy.yml` failure to the alerts channel is a follow-up.
- **Render's `notification_override` is intentionally unmanaged by Terraform.** It is in the `lifecycle.ignore_changes` list at `infra/terraform/modules/render/web_service.tf:67-84`, because Render's free-tier API rejects paid-tier-only fields that the provider otherwise re-sends on every update. Render-native deploy and service notifications are therefore configured in the Render dashboard, not in code. Forks on a paid plan can shrink that list and manage the field explicitly.

## Verifying alerting works

Capture and notification are separate systems, and only the second one is configured by hand. Run this drill once after creating the rules, and again whenever the rules or the channel change.

1. Add a temporary oRPC procedure (or a temporary `throw new Error("alerting drill")` inside an existing handler) on a branch, and deploy it to **staging**.
2. Call it from the staging frontend so the request carries a client-minted `x-request-id`.
3. In Rollbar, open the `genesis-server-staging` project and confirm a new item appeared within about 10 seconds.
4. Check the item's **level** is what you expected (`error` for a bare throw) and that `custom.requestId` is present.
5. Search the Render logs for that `requestId` and confirm the matching pino lines are there.
6. Confirm the notification actually landed in the staging channel. This is the step that proves the console rules are live, and it is the one that silently fails if a rule was never saved.
7. Revert the temporary throw.

To check the paging path specifically, repeat with a `critical` report and confirm rule (a) fires. Do that in a quiet window and tell the on-call engineer first.
