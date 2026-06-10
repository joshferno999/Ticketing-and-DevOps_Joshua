import type { ReachabilityLatencyResponse } from "@emergence-devops/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function fetchReachabilityLatency(): Promise<ReachabilityLatencyResponse> {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }

  const response = await fetch(`${API_BASE_URL}/reachability/latency`);
  const payload = (await response.json().catch(() => null)) as
    | (ReachabilityLatencyResponse & { message?: string })
    | null;

  if (!response.ok) {
    if (payload && Array.isArray(payload.probes)) {
      return {
        probes: payload.probes,
        fetchedAt: payload.fetchedAt ?? new Date().toISOString(),
        cacheExpiresAt: payload.cacheExpiresAt ?? new Date().toISOString()
      };
    }

    throw new Error(
      payload?.message ?? `Reachability request failed with status ${response.status}`
    );
  }

  if (!payload || !Array.isArray(payload.probes)) {
    throw new Error("Reachability response was invalid");
  }

  return payload;
}
