import { describe, expect, it, vi, beforeEach } from "vitest";
import type { env } from "../../config/env";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-cloudwatch", () => ({
  CloudWatchClient: vi.fn(() => ({ send: sendMock })),
  GetMetricStatisticsCommand: vi.fn((input: unknown) => input)
}));

import { createReachabilityService } from "./reachability.service";

const testEnv = {
  ROUTE53_HEALTH_CHECK_ID: "5021ff48-e1e7-4f02-af89-28d54734cb06",
  ROUTE53_METRICS_REGION: "us-east-1",
  REACHABILITY_CACHE_TTL_SECONDS: 3600
} as typeof env;

describe("createReachabilityService", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("returns null latency when CloudWatch has no datapoints", async () => {
    sendMock.mockResolvedValue({ Datapoints: [] });

    const service = createReachabilityService(testEnv);
    const result = await service.getLatency();

    expect(result.probes).toHaveLength(8);
    expect(result.probes.every((probe) => probe.latencyMs === null)).toBe(true);
    expect(result.probes.every((probe) => probe.measuredAt === null)).toBe(true);
  });

  it("rounds the latest Average datapoint to latencyMs", async () => {
    sendMock.mockResolvedValue({
      Datapoints: [
        {
          Timestamp: new Date("2026-05-21T10:00:00Z"),
          Average: 142.6
        }
      ]
    });

    const service = createReachabilityService(testEnv);
    const result = await service.getLatency();

    expect(result.probes[0]?.latencyMs).toBe(143);
    expect(result.probes[0]?.measuredAt).toBe("2026-05-21T10:00:00.000Z");
  });

  it("serves cached responses within TTL without extra CloudWatch calls", async () => {
    sendMock.mockResolvedValue({
      Datapoints: [
        {
          Timestamp: new Date("2026-05-21T10:00:00Z"),
          Average: 100
        }
      ]
    });

    const service = createReachabilityService(testEnv);
    await service.getLatency();
    await service.getLatency();

    expect(sendMock).toHaveBeenCalledTimes(8);
  });
});
