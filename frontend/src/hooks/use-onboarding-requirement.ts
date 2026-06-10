import { useCallback, useEffect, useState } from "react";
import type { OnboardingState } from "@emergence-devops/shared";
import { requiresAsanaOnboarding } from "../lib/onboarding";
import { api, ApiError } from "../lib/api";

export function useOnboardingRequirement(enabled: boolean) {
  const [loading, setLoading] = useState(enabled);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setState(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const nextState = await api.getOnboarding();
      setState(nextState);
      return nextState;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Onboarding status could not be loaded.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    loading,
    error,
    state,
    requiresOnboarding: requiresAsanaOnboarding(state),
    reload
  };
}
