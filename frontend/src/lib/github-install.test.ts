import { describe, expect, it } from "vitest";
import { resolveGitHubInstallApiBaseUrl, resolveGitHubInstallRedirect } from "./github-install";

describe("resolveGitHubInstallApiBaseUrl", () => {
  it("prefers the current origin on production hosts", () => {
    expect(
      resolveGitHubInstallApiBaseUrl("http://localhost:4000/api", "https://devops.emsoft.com")
    ).toBe("https://devops.emsoft.com/api");
  });

  it("keeps localhost API base during local development", () => {
    expect(
      resolveGitHubInstallApiBaseUrl("http://localhost:4000/api", "http://localhost:5173")
    ).toBe("http://localhost:4000/api");
  });
});

describe("resolveGitHubInstallRedirect", () => {
  it("builds a backend setup redirect when installation_id and state are present", () => {
    expect(
      resolveGitHubInstallRedirect(
        { search: "?installation_id=123&state=signed-token", origin: "http://localhost:5173" },
        "http://localhost:4000/api"
      )
    ).toBe("http://localhost:4000/api/integrations/github/setup?installation_id=123&state=signed-token");
  });

  it("uses the production API host when GitHub lands on the production SPA", () => {
    expect(
      resolveGitHubInstallRedirect(
        { search: "?installation_id=123&state=signed-token", origin: "https://devops.emsoft.com" },
        "http://localhost:4000/api"
      )
    ).toBe("https://devops.emsoft.com/api/integrations/github/setup?installation_id=123&state=signed-token");
  });

  it("does not require setup_action to finalize the install", () => {
    expect(
      resolveGitHubInstallRedirect(
        { search: "?installation_id=123&state=signed-token&setup_action=install", origin: "http://localhost:5173" },
        "http://localhost:4000/api"
      )
    ).toBe("http://localhost:4000/api/integrations/github/setup?installation_id=123&state=signed-token");
  });

  it("still forwards the callback when GitHub omits state", () => {
    expect(
      resolveGitHubInstallRedirect(
        { search: "?installation_id=123&setup_action=install", origin: "http://localhost:5173" },
        "http://localhost:4000/api"
      )
    ).toBe("http://localhost:4000/api/integrations/github/setup?installation_id=123");
  });

  it("returns null when the redirect is incomplete", () => {
    expect(
      resolveGitHubInstallRedirect(
        { search: "?setup_action=install", origin: "http://localhost:5173" },
        "http://localhost:4000/api"
      )
    ).toBeNull();
  });
});
