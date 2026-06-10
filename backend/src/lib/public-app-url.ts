import type { FastifyRequest } from "fastify";

function isLocalhostHost(host: string) {
  const normalized = host.toLowerCase();
  return normalized.includes("localhost") || normalized.startsWith("127.0.0.1") || normalized.startsWith("[::1]");
}

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim();
  }

  return value?.trim();
}

export function resolvePublicAppUrl(configuredUrl: string, request?: Pick<FastifyRequest, "headers">) {
  const configured = configuredUrl.replace(/\/$/, "");
  if (!isLocalhostHost(new URL(configured).host)) {
    return configured;
  }

  if (!request) {
    return configured;
  }

  const forwardedHost = firstHeaderValue(request.headers["x-forwarded-host"]);
  const forwardedProto = firstHeaderValue(request.headers["x-forwarded-proto"]) ?? "https";
  if (forwardedHost && !isLocalhostHost(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = firstHeaderValue(request.headers.host);
  if (host && !isLocalhostHost(host)) {
    const proto = forwardedProto === "http" ? "http" : "https";
    return `${proto}://${host}`;
  }

  return configured;
}

export function buildGitHubSetupCallbackUrl(publicAppUrl: string) {
  return `${publicAppUrl.replace(/\/$/, "")}/api/integrations/github/setup`;
}
