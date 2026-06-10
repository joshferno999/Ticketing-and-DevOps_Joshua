import { useCallback, useEffect, useRef, useState } from "react";
import type { OnboardingState } from "@emergence-devops/shared";
import { api, ApiError, type IntegrationStatusPayload } from "../lib/api";
import { fetchIntegrationBootstrap, type IntegrationBootstrapResult } from "./use-integration-bootstrap";

export type OnboardingBootstrapResult = {
  state: OnboardingState;
  integrations: IntegrationBootstrapResult;
};

export function useOnboardingBootstrap(enabled: boolean) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingBootstrapResult | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (!options?.silent) {
      setError(null);
    }

    try {
      const payload = await fetchOnboardingBootstrap();
      if (requestRef.current !== requestId) {
        return payload;
      }

      setData(payload);
      return payload;
    } catch (cause) {
      if (requestRef.current !== requestId) {
        return null;
      }

      if (!options?.silent) {
        setError(cause instanceof ApiError ? cause.message : "Onboarding data could not be loaded.");
      }
      return null;
    } finally {
      if (requestRef.current === requestId) {
        setReady(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    setReady(false);
    void load();
  }, [enabled, load]);

  return {
    ready,
    error,
    data,
    reload: load
  };
}

export async function fetchOnboardingBootstrap(): Promise<OnboardingBootstrapResult> {
  const [state, integrations] = await Promise.all([
    api.getOnboarding(),
    fetchIntegrationBootstrap()
  ]);

  return {
    state,
    integrations
  };
}

export type { IntegrationStatusPayload };
