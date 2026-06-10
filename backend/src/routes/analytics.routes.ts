import type { FastifyInstance } from "fastify";
import { requireAuth } from "../modules/auth/auth.plugin";
import { createAnalyticsService } from "../modules/analytics/analytics.service";

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  const analyticsService = createAnalyticsService(app.prisma, app.githubService);

  app.get("/analytics/snapshot", { preHandler: requireAuth }, async (request) => {
    const weeks = Number((request.query as { weeks?: string } | undefined)?.weeks ?? 4);
    return analyticsService.getSnapshot(request.appUser!.id, Number.isFinite(weeks) ? weeks : 4);
  });
}
