import { describe, expect, it } from "vitest";
import { buildGitHubSetupCallbackUrl, resolvePublicAppUrl } from "./public-app-url";

describe("resolvePublicAppUrl", () => {
  it("keeps a non-local configured URL", () => {
    expect(resolvePublicAppUrl("https://devops.emsoft.com")).toBe("https://devops.emsoft.com");
  });

  it("derives the public URL from forwarded headers when config is localhost", () => {
    expect(
      resolvePublicAppUrl("http://localhost:5173", {
        headers: {
          "x-forwarded-host": "devops.emsoft.com",
          "x-forwarded-proto": "https"
        }
      })
    ).toBe("https://devops.emsoft.com");
  });

  it("falls back to the configured URL when no public host is available", () => {
    expect(resolvePublicAppUrl("http://localhost:5173")).toBe("http://localhost:5173");
  });
});

describe("buildGitHubSetupCallbackUrl", () => {
  it("builds the backend setup callback path", () => {
    expect(buildGitHubSetupCallbackUrl("https://devops.emsoft.com")).toBe(
      "https://devops.emsoft.com/api/integrations/github/setup"
    );
  });
});
