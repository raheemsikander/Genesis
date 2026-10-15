import crypto from "node:crypto";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { OpenAPIHandler } from "@orpc/openapi/node";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/node";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import { z } from "zod";
import { mountQueueDashboard } from "./async-tasks/dashboard";
import { closeAllQueues } from "./async-tasks/job-registry";
import { pool } from "./db";
import { requireAdmin } from "./middleware/require-admin";
import { appRouter, createAuthContext } from "./orpc";
import { errorInterceptors } from "./orpc/error-interceptor";
import { flushAlerts, isAlertable, reportAlert } from "./utils/alerting";
import { env } from "./utils/env";
import { installFatalHandlers } from "./utils/fatal-handlers";
import { checkHealth, reportUnhealthyDependencies } from "./utils/health";
import { logger } from "./utils/logger";
import { runWithRequestContext } from "./utils/request-context";
import { rollbar } from "./utils/rollbar";

const uuidSchema = z.string().uuid();

installFatalHandlers();

const app = express();

const requestHandler = rollbar.expressMiddleware();
if (requestHandler) {
	app.use(requestHandler);
}

// Suppress health check logs — Render pings /health every few seconds and floods the logs
app.use(
	pinoHttp({
		logger,
		// Reuse the x-request-id header from the client (e.g. frontend) if it's a valid UUID,
		// otherwise generate a new one. Echoed back via response header for end-to-end tracing.
		genReqId: (req, res) => {
			const header = req.headers["x-request-id"];
			const parsed = uuidSchema.safeParse(header);
			const id = parsed.success ? parsed.data : crypto.randomUUID();
			res.setHeader("x-request-id", id);
			return id;
		},
		autoLogging: {
			ignore: (req) => req.url === "/health" || req.url === "/health/detailed",
		},
	}),
);

// ALS context — after pino-http so req.id is already set
app.use((req, _res, next) => {
	runWithRequestContext({ requestId: req.id as string }, () => next());
});

app.use(
	cors({
		origin: env.CORS_ORIGIN,
		methods: ["GET", "POST", "OPTIONS"],
	}),
);

app.use(clerkMiddleware());

// Attach Clerk user identity to Rollbar so all errors in this request include the person
app.use((req, _res, next) => {
	const { userId } = getAuth(req);
	if (userId) {
		rollbar.configure({ payload: { person: { id: userId } } });
	}
	next();
});

app.get("/health", (_req, res) => {
	res.json({ ok: true });
});

app.get("/health/detailed", async (_req, res) => {
	const report = await checkHealth();
	if (report.status !== "ok") {
		logger.warn({ checks: report.checks }, "detailed health check degraded");
		reportUnhealthyDependencies(report);
	}
	res.status(report.status === "ok" ? 200 : 503).json(report);
});

// Dashboard is development only. Production exposure requires explicit ops sign-off
if (env.NODE_ENV === "development") {
	mountQueueDashboard(app, "/admin/jobs", requireAdmin);
}

const orpcHandler = new RPCHandler(appRouter, {
	interceptors: errorInterceptors,
});

const apiHandler =
	env.NODE_ENV !== "production"
		? new OpenAPIHandler(appRouter, {
				plugins: [
					new OpenAPIReferencePlugin({
						schemaConverters: [new ZodToJsonSchemaConverter()],
					}),
				],
				interceptors: errorInterceptors,
			})
		: null;

app.use(async (req, res, next) => {
	const orpcResult = await orpcHandler.handle(req, res, {
		prefix: "/rpc",
		context: await createAuthContext({ req }),
	});
	if (orpcResult.matched) return;

	if (apiHandler) {
		const apiResult = await apiHandler.handle(req, res, {
			prefix: "/api-reference",
			context: await createAuthContext({ req }),
		});
		if (apiResult.matched) return;
	}

	next();
});

app.use(
	(
		err: unknown,
		req: express.Request,
		res: express.Response,
		_next: express.NextFunction,
	) => {
		logger.error(
			{ err, method: req.method, url: req.url },
			"unhandled express error",
		);

		if (isAlertable(err)) {
			reportAlert(err, {
				request: req,
				context: { method: req.method, url: req.url },
			});
		}

		res.status(500).json({
			error: "Internal Server Error",
			requestId: (req.id as string | undefined) ?? "unknown",
		});
	},
);

const server = app.listen(env.PORT, () => {
	logger.info(`Server is running on http://localhost:${env.PORT}`);
});

async function gracefulShutdown(signal: string) {
	logger.info(`${signal} received — shutting down gracefully`);

	setTimeout(async () => {
		logger.warn("Shutdown timed out — forcing exit");
		await flushAlerts();
		process.exit(1);
	}, 10_000).unref();

	server.close(async (err) => {
		if (err) logger.error(err, "Error closing HTTP server");
		try {
			await closeAllQueues();
		} catch (e) {
			logger.error(e, "Error closing queues");
		}
		try {
			await pool.end();
		} catch (e) {
			logger.error(e, "Error closing pool");
		}
		logger.info("Database pool drained, exiting");
		await flushAlerts();
		process.exit(0);
	});
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
