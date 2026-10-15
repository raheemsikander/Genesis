import { z } from "zod";

// ----- Outputs -----

export const HealthCheckResultSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("ok"),
		latencyMs: z.number(),
	}),
	z.object({
		status: z.literal("error"),
		error: z.string(),
		latencyMs: z.number(),
	}),
	z.object({
		status: z.literal("skipped"),
		reason: z.string(),
	}),
]);

export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

export const HealthReportSchema = z.object({
	status: z.enum(["ok", "degraded"]),
	uptimeSeconds: z.number(),
	checks: z.object({
		database: HealthCheckResultSchema,
		redis: HealthCheckResultSchema,
		storage: HealthCheckResultSchema,
	}),
});

export type HealthReport = z.infer<typeof HealthReportSchema>;
