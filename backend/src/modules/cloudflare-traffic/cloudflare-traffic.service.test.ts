import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { env } from "../../config/env";
import { createCloudflareTrafficService } from "./cloudflare-traffic.service";

const testEnv = {
  CLOUDFLARE_API_TOKEN: "test-token",
  CLOUDFLARE_ZONE_ID: "zone-123",
  CLOUDFLARE_TRAFFIC_CACHE_TTL_SECONDS: 3600
} as typeof env;

const samplePayload = {
  data: {
    viewer: {
      zones: [
        {
          httpRequestsAdaptiveGroups: [
            { count: 100, dimensions: { clientCountryName: "US" } },
            { count: 50, dimensions: { clientCountryName: "IN" } },
            { count: 25, dimensions: { clientCountryName: "XX" } }
          ]
        }
      ]
    }
  },
  errors: null
};

describe("createCloudflareTrafficService", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => samplePayload
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns top countries with normalized pillar altitudes", async () => {
    const service = createCloudflareTrafficService(testEnv);
    const result = await service.getTraffic();

    expect(result.countries).toHaveLength(2);
    expect(result.countries[0]?.countryCode).toBe("US");
    expect(result.countries[0]?.altitude).toBeCloseTo(0.34, 5);
    expect(result.countries[1]?.countryCode).toBe("IN");
    expect(result.countries[1]?.altitude).toBeGreaterThan(0.2);
    expect(result.countries[1]?.altitude).toBeLessThan(0.34);
  });

  it("serves cached responses within TTL", async () => {
    const service = createCloudflareTrafficService(testEnv);
    await service.getTraffic();
    await service.getTraffic();

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
