import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  type Datapoint
} from "@aws-sdk/client-cloudwatch";
import type { ReachabilityLatencyResponse, ReachabilityProbe } from "@emergence-devops/shared";
import type { env } from "../../config/env";
import { REACHABILITY_PROBES } from "./reachability.config";

type Env = typeof env;

type CacheEntry = {
  data: ReachabilityLatencyResponse;
  expiresAt: number;
};

function pickLatestDatapoint(datapoints: Datapoint[]): Datapoint | null {
  if (datapoints.length === 0) {
    return null;
  }

  return [...datapoints].sort((left, right) => {
    const leftTime = left.Timestamp?.getTime() ?? 0;
    const rightTime = right.Timestamp?.getTime() ?? 0;
    return leftTime - rightTime;
  }).at(-1) ?? null;
}

export function createReachabilityService(config: Env) {
  // Default SDK credential chain: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (+ optional
  // AWS_SESSION_TOKEN), then ECS task role via instance metadata. No named AWS profile.
  const cloudWatch = new CloudWatchClient({
    region: config.ROUTE53_METRICS_REGION
  });
  const cacheTtlMs = config.REACHABILITY_CACHE_TTL_SECONDS * 1000;

  let cache: CacheEntry | null = null;
  let inflight: Promise<ReachabilityLatencyResponse> | null = null;

  async function fetchRegionLatency(awsRegion: string): Promise<{
    latencyMs: number | null;
    measuredAt: string | null;
  }> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);

    const response = await cloudWatch.send(
      new GetMetricStatisticsCommand({
        Namespace: "AWS/Route53",
        MetricName: "TimeToFirstByte",
        Dimensions: [
          { Name: "HealthCheckId", Value: config.ROUTE53_HEALTH_CHECK_ID },
          { Name: "Region", Value: awsRegion }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ["Average"]
      })
    );

    const latest = pickLatestDatapoint(response.Datapoints ?? []);
    if (latest?.Average == null || latest.Timestamp == null) {
      return { latencyMs: null, measuredAt: null };
    }

    return {
      latencyMs: Math.round(latest.Average),
      measuredAt: latest.Timestamp.toISOString()
    };
  }

  async function loadFresh(): Promise<ReachabilityLatencyResponse> {
    const fetchedAt = new Date();
    const results = await Promise.all(
      REACHABILITY_PROBES.map(async (probe): Promise<ReachabilityProbe> => {
        const { latencyMs, measuredAt } = await fetchRegionLatency(probe.awsRegion);
        return {
          id: probe.id,
          label: probe.label,
          awsRegion: probe.awsRegion,
          lat: probe.lat,
          lng: probe.lng,
          latencyMs,
          measuredAt
        };
      })
    );

    const cacheExpiresAt = new Date(fetchedAt.getTime() + cacheTtlMs);
    return {
      probes: results,
      fetchedAt: fetchedAt.toISOString(),
      cacheExpiresAt: cacheExpiresAt.toISOString()
    };
  }

  function getCachedLatency(): ReachabilityLatencyResponse | null {
    if (!cache) {
      return null;
    }
    return cache.data;
  }

  async function getLatency(): Promise<ReachabilityLatencyResponse> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
      return cache.data;
    }

    if (!inflight) {
      inflight = loadFresh()
        .then((data) => {
          cache = {
            data,
            expiresAt: Date.now() + cacheTtlMs
          };
          return data;
        })
        .finally(() => {
          inflight = null;
        });
    }

    return inflight;
  }

  function startBackgroundRefresh() {
    const intervalMs = cacheTtlMs;
    const timer = setInterval(() => {
      void loadFresh()
        .then((data) => {
          cache = {
            data,
            expiresAt: Date.now() + cacheTtlMs
          };
        })
        .catch((error) => {
          console.error("[reachability] background refresh failed", error);
        });
    }, intervalMs);

    timer.unref?.();
  }

  return {
    getLatency,
    getCachedLatency,
    startBackgroundRefresh
  };
}

export function isReachabilityAccessDenied(error: unknown) {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: string }).name)
      : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    name === "AccessDenied" ||
    name === "AccessDeniedException" ||
    message.includes("not authorized to perform: cloudwatch:GetMetricStatistics")
  );
}

export type ReachabilityService = ReturnType<typeof createReachabilityService>;
