import { z } from "zod";

export const SampleBackgroundPayload = z.object({
	userId: z.string(),
	email: z.string(),
	requestId: z.string().uuid().optional(),
});

export type SampleBackgroundPayload = z.infer<typeof SampleBackgroundPayload>;

export const DeadLetterPayload = z.object({
	originalQueue: z.string(),
	jobId: z.string(),
	payload: z.unknown(),
	error: z.string(),
	failedAt: z.string(),
	requestId: z.string().uuid().optional(),
});

export type DeadLetterPayload = z.infer<typeof DeadLetterPayload>;

export const ScheduleConfig = z.object({
	schedulerId: z.string(),
	pattern: z.string(),
	data: z.unknown().optional(),
});

export type ScheduleConfig = z.infer<typeof ScheduleConfig>;
