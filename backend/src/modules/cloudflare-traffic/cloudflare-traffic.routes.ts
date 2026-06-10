import type { FastifyInstance } from "fastify";
import {
  createCloudflareTrafficService,
  isCloudflareTrafficConfigured
} from "./cloudflare-traffic.service";

function emptyTrafficResponse() {
  const fetchedAt = new Date().toISOString();
  return {
    countries: [],
    fetchedAt,
    cacheExpiresAt: fetchedAt,
    date: fetchedAt.slice(0, 10),
    stale: false,
    error: "cloudflare_traffic_unavailable" as const
  };
}

export async function registerCloudflareTrafficRoutes(app: FastifyInstance) {
  const trafficService = createCloudflareTrafficService(app.config);
  trafficService.startBackgroundRefresh();

  app.get("/traffic/cloudflare", async (request, reply) => {
    if (!isCloudflareTrafficConfigured(app.config)) {
      return reply.status(503).send({
        ...emptyTrafficResponse(),
        message:
          "Cloudflare traffic is not configured. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID in backend/.env or ECS secrets."
      });
    }

    try {
      const data = await trafficService.getTraffic();
      return { ...data, stale: false };
    } catch (error) {
      request.log.error({ err: error }, "cloudflare traffic fetch failed");

      const cached = trafficService.getCachedTraffic();
      if (cached) {
        return { ...cached, stale: true, error: "cloudflare_traffic_stale_cache" };
      }

      return reply.status(503).send({
        ...emptyTrafficResponse(),
        message:
          error instanceof Error ? error.message : "Cloudflare traffic is temporarily unavailable."
      });
    }
  });
}
