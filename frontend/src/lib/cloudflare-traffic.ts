import type { CloudflareTrafficResponse } from "@emergence-devops/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function fetchCloudflareTraffic(): Promise<CloudflareTrafficResponse> {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }

  const response = await fetch(`${API_BASE_URL}/traffic/cloudflare`);
  const payload = (await response.json().catch(() => null)) as
    | (CloudflareTrafficResponse & { message?: string })
    | null;

  if (!response.ok) {
    if (payload && Array.isArray(payload.countries)) {
      return {
        countries: payload.countries,
        fetchedAt: payload.fetchedAt ?? new Date().toISOString(),
        cacheExpiresAt: payload.cacheExpiresAt ?? new Date().toISOString(),
        date: payload.date ?? new Date().toISOString().slice(0, 10)
      };
    }

    throw new Error(
      payload?.message ?? `Cloudflare traffic request failed with status ${response.status}`
    );
  }

  if (!payload || !Array.isArray(payload.countries)) {
    throw new Error("Cloudflare traffic response was invalid");
  }

  return payload;
}
