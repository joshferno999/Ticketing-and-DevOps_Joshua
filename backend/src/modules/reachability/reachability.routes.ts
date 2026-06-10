import type { FastifyInstance } from "fastify";
import { REACHABILITY_PROBES } from "./reachability.config";
import {
  createReachabilityService,
  isReachabilityAccessDenied
} from "./reachability.service";

function emptyProbeResponse() {
  const fetchedAt = new Date().toISOString();
  return {
    probes: REACHABILITY_PROBES.map((probe) => ({
      id: probe.id,
      label: probe.label,
      awsRegion: probe.awsRegion,
      lat: probe.lat,
      lng: probe.lng,
      latencyMs: null,
      measuredAt: null
    })),
    fetchedAt,
    cacheExpiresAt: fetchedAt,
    stale: false,
    error: "reachability_unavailable" as const
  };
}

export async function registerReachabilityRoutes(app: FastifyInstance) {
  const reachabilityService = createReachabilityService(app.config);
  reachabilityService.startBackgroundRefresh();

  app.get("/reachability/latency", async (request, reply) => {
    try {
      const data = await reachabilityService.getLatency();
      return { ...data, stale: false };
    } catch (error) {
      request.log.error({ err: error }, "reachability latency fetch failed");

      const cached = reachabilityService.getCachedLatency();
      if (cached) {
        return { ...cached, stale: true, error: "reachability_stale_cache" };
      }

      const message = isReachabilityAccessDenied(error)
        ? "CloudWatch access denied. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (and AWS_REGION=us-east-1) in backend/.env or ECS secrets, or use the ECS task role with cloudwatch:GetMetricStatistics. See infra/iam/README.md."
        : "Reachability metrics are temporarily unavailable.";

      return reply.status(503).send({
        ...emptyProbeResponse(),
        message
      });
    }
  });
}
