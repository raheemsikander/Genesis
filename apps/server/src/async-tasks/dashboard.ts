import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { Application, RequestHandler, Router } from "express";
import { getQueue, QUEUES } from "./job-registry";

export function createQueueDashboardRouter(basePath: string): Router {
	const serverAdapter = new ExpressAdapter();
	serverAdapter.setBasePath(basePath);

	createBullBoard({
		queues: Object.values(QUEUES).map(
			(name) => new BullMQAdapter(getQueue(name)),
		),
		serverAdapter,
	});

	return serverAdapter.getRouter() as Router;
}

export function mountQueueDashboard(
	app: Application,
	basePath: string,
	guard: RequestHandler,
): void {
	app.use(basePath, guard, createQueueDashboardRouter(basePath));
}
