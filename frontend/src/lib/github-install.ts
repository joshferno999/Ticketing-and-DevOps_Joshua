function isLocalhostHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function resolveGitHubInstallApiBaseUrl(configuredApiBaseUrl?: string, origin?: string) {
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (!isLocalhostHostname(originUrl.hostname)) {
        return `${originUrl.origin}/api`;
      }
    } catch {
      // Fall through to configured API base URL.
    }
  }

  return configuredApiBaseUrl?.replace(/\/$/, "") ?? null;
}

export function resolveGitHubInstallRedirect(
  locationLike: Pick<Location, "search" | "origin">,
  configuredApiBaseUrl?: string
) {
  const apiBaseUrl = resolveGitHubInstallApiBaseUrl(configuredApiBaseUrl, locationLike.origin);
  if (!apiBaseUrl) {
    return null;
  }

  const params = new URLSearchParams(locationLike.search);
  const installationId = params.get("installation_id");
  const state = params.get("state");

  if (!installationId) {
    return null;
  }

  const redirectUrl = new URL(`${apiBaseUrl}/integrations/github/setup`);
  redirectUrl.searchParams.set("installation_id", installationId);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }
  return redirectUrl.toString();
}
