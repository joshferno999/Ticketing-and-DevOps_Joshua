import type {
  CloudflareTrafficCountry,
  CloudflareTrafficResponse
} from "@emergence-devops/shared";
import type { env } from "../../config/env";
import { resolveCountryCentroid } from "./country-centroids";

type Env = typeof env;

const CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const TOP_COUNTRY_LIMIT = 15;
const MIN_PILLAR_ALTITUDE = 0.06;
const MAX_PILLAR_ALTITUDE = 0.34;
const ALTITUDE_CURVE_EXPONENT = 0.62;

type CacheEntry = {
  data: CloudflareTrafficResponse;
  expiresAt: number;
};

type GraphqlGroup = {
  count: number;
  dimensions: { clientCountryName: string };
};

type GraphqlResponse = {
  data?: {
    viewer?: {
      zones?: Array<{
        httpRequestsAdaptiveGroups?: GraphqlGroup[];
      }>;
    };
  };
  errors?: Array<{ message: string }>;
};

function utcDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildTrafficQuery(zoneId: string, date: string) {
  return {
    query: `{
      viewer {
        zones(filter: { zoneTag: "${zoneId}" }) {
          httpRequestsAdaptiveGroups(
            limit: 50,
            filter: { date_geq: "${date}", date_leq: "${date}" },
            orderBy: [count_DESC]
          ) {
            count
            dimensions { clientCountryName }
          }
        }
      }
    }`
  };
}

function normalizeCountries(groups: GraphqlGroup[]): CloudflareTrafficCountry[] {
  const mapped = groups
    .map((group) => {
      const countryCode = group.dimensions.clientCountryName?.toUpperCase();
      if (!countryCode) {
        return null;
      }

      const centroid = resolveCountryCentroid(countryCode);
      if (!centroid) {
        console.warn(`[cloudflare-traffic] no centroid for country code ${countryCode}`);
        return null;
      }

      return {
        countryCode,
        countryName: centroid.name,
        count: group.count,
        lat: centroid.lat,
        lng: centroid.lng,
        altitude: MIN_PILLAR_ALTITUDE
      };
    })
    .filter((entry): entry is CloudflareTrafficCountry => entry !== null)
    .sort((left, right) => right.count - left.count)
    .slice(0, TOP_COUNTRY_LIMIT);

  const maxCount = mapped[0]?.count ?? 0;
  if (maxCount <= 0) {
    return mapped;
  }

  return mapped.map((country) => {
    const normalized = Math.pow(country.count / maxCount, ALTITUDE_CURVE_EXPONENT);
    return {
      ...country,
      altitude: MIN_PILLAR_ALTITUDE + normalized * (MAX_PILLAR_ALTITUDE - MIN_PILLAR_ALTITUDE)
    };
  });
}

export function isCloudflareTrafficConfigured(config: Env) {
  return Boolean(config.CLOUDFLARE_API_TOKEN && config.CLOUDFLARE_ZONE_ID);
}

export function createCloudflareTrafficService(config: Env) {
  const cacheTtlMs = config.CLOUDFLARE_TRAFFIC_CACHE_TTL_SECONDS * 1000;
  let cache: CacheEntry | null = null;
  let inflight: Promise<CloudflareTrafficResponse> | null = null;

  async function fetchFromCloudflare(): Promise<CloudflareTrafficResponse> {
    if (!isCloudflareTrafficConfigured(config)) {
      throw new Error("Cloudflare traffic is not configured");
    }

    const date = utcDateString(new Date());
    const response = await fetch(CLOUDFLARE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildTrafficQuery(config.CLOUDFLARE_ZONE_ID!, date))
    });

    const payload = (await response.json()) as GraphqlResponse;
    if (!response.ok) {
      throw new Error(
        payload.errors?.[0]?.message ?? `Cloudflare GraphQL failed with status ${response.status}`
      );
    }

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const groups = payload.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    const fetchedAt = new Date();
    const countries = normalizeCountries(groups);

    return {
      countries,
      fetchedAt: fetchedAt.toISOString(),
      cacheExpiresAt: new Date(fetchedAt.getTime() + cacheTtlMs).toISOString(),
      date
    };
  }

  async function loadFresh() {
    return fetchFromCloudflare();
  }

  function getCachedTraffic(): CloudflareTrafficResponse | null {
    return cache?.data ?? null;
  }

  async function getTraffic(): Promise<CloudflareTrafficResponse> {
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
    if (!isCloudflareTrafficConfigured(config)) {
      return;
    }

    const timer = setInterval(() => {
      void loadFresh()
        .then((data) => {
          cache = {
            data,
            expiresAt: Date.now() + cacheTtlMs
          };
        })
        .catch((error) => {
          console.error("[cloudflare-traffic] background refresh failed", error);
        });
    }, cacheTtlMs);

    timer.unref?.();
  }

  return {
    getTraffic,
    getCachedTraffic,
    startBackgroundRefresh
  };
}

export type CloudflareTrafficService = ReturnType<typeof createCloudflareTrafficService>;
