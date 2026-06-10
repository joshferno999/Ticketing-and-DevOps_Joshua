import type { FastifyInstance } from "fastify";
import { registerIntegrationRoutes } from "../modules/integrations/integrations.routes";
import { registerSystemRoutes } from "./system.routes";
import { registerBoardRoutes } from "./boards.routes";
import { registerAnalyticsRoutes } from "./analytics.routes";
import { registerWebhookRoutes } from "./webhooks.routes";
import { registerIntegrationDataRoutes } from "./integrations.routes";
import { registerRepositoryRoutes } from "./repositories.routes";
import { registerReachabilityRoutes } from "../modules/reachability/reachability.routes";
import { registerCloudflareTrafficRoutes } from "../modules/cloudflare-traffic/cloudflare-traffic.routes";

export async function registerRoutes(app: FastifyInstance) {
  app.register(registerSystemRoutes, { prefix: "/api" });
  app.register(registerReachabilityRoutes, { prefix: "/api" });
  app.register(registerCloudflareTrafficRoutes, { prefix: "/api" });
  app.register(registerIntegrationRoutes, { prefix: "/api" });
  app.register(registerBoardRoutes, { prefix: "/api" });
  app.register(registerAnalyticsRoutes, { prefix: "/api" });
  app.register(registerIntegrationDataRoutes, { prefix: "/api" });
  app.register(registerRepositoryRoutes, { prefix: "/api" });
  app.register(registerWebhookRoutes, { prefix: "/api" });
}
