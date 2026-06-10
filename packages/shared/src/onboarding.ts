import type { OnboardingState } from "./types";

export function requiresAsanaOnboarding(
  state: Pick<OnboardingState, "asanaConnected"> | null | undefined
) {
  return state != null && !state.asanaConnected;
}

export function parseOnboardingState(payload: unknown): OnboardingState | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.asanaConnected === "boolean") {
    return record as unknown as OnboardingState;
  }

  const nested = record.data;
  if (nested && typeof nested === "object" && typeof (nested as OnboardingState).asanaConnected === "boolean") {
    return nested as unknown as OnboardingState;
  }

  return null;
}
