import { describe, expect, it } from "vitest";
import { parseOnboardingState, requiresAsanaOnboarding } from "./onboarding";

describe("requiresAsanaOnboarding", () => {
  it("requires onboarding when Asana is not connected", () => {
    expect(requiresAsanaOnboarding({ asanaConnected: false })).toBe(true);
  });

  it("does not block the app when onboarding status is unknown", () => {
    expect(requiresAsanaOnboarding(null)).toBe(false);
    expect(requiresAsanaOnboarding(undefined)).toBe(false);
  });

  it("does not require onboarding when Asana is connected", () => {
    expect(requiresAsanaOnboarding({ asanaConnected: true })).toBe(false);
  });
});

describe("parseOnboardingState", () => {
  it("reads a flat onboarding payload", () => {
    expect(parseOnboardingState({ asanaConnected: true, accountConnected: true })).toMatchObject({
      asanaConnected: true
    });
  });

  it("reads a wrapped onboarding payload", () => {
    expect(
      parseOnboardingState({
        data: { asanaConnected: false, accountConnected: true },
        source: "database"
      })
    ).toMatchObject({
      asanaConnected: false
    });
  });
});
