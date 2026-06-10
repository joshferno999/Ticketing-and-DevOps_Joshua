import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  type AsanaProjectOption,
  type AsanaWorkspaceOption,
  type IntegrationStatusPayload
} from "../lib/api";

export type IntegrationBootstrapResult = {
  status: IntegrationStatusPayload;
  workspaces: AsanaWorkspaceOption[];
  projects: AsanaProjectOption[];
};

export function useIntegrationBootstrap(enabled: boolean) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<IntegrationBootstrapResult | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (!options?.silent) {
      setError(null);
    }

    try {
      const payload = await fetchIntegrationBootstrap();
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
        setError(cause instanceof ApiError ? cause.message : "Integration data could not be loaded.");
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

export async function fetchIntegrationBootstrap(): Promise<IntegrationBootstrapResult> {
  const status = await api.getIntegrationStatus();

  if (!status.asana.connected) {
    return {
      status,
      workspaces: [],
      projects: []
    };
  }

  const workspaces = await api.getAsanaWorkspaces();
  const primaryWorkspace = workspaces[0];

  if (!primaryWorkspace) {
    return {
      status,
      workspaces,
      projects: []
    };
  }

  const projects = await api.getAsanaProjects(primaryWorkspace.gid);

  return {
    status,
    workspaces,
    projects
  };
}
