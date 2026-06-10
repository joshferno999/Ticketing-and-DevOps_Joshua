import { useEffect, useState } from "react";
import type { WorkspaceCapabilities } from "@emergence-devops/shared";
import { api, ApiError } from "../lib/api";
import { useSession } from "./use-session";

const defaultCapabilities: WorkspaceCapabilities = {
  canEditBoards: false,
  canAccessRepos: false
};

export function useWorkspaceCapabilities() {
  const { loading, user } = useSession();
  const [capabilities, setCapabilities] = useState<WorkspaceCapabilities>(defaultCapabilities);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let cancelled = false;

    void api.getIntegrationStatus()
      .then((status) => {
        if (!cancelled) {
          setCapabilities(status.capabilities ?? defaultCapabilities);
        }
      })
      .catch((cause) => {
        if (!cancelled && !(cause instanceof ApiError && cause.status === 401)) {
          setCapabilities(defaultCapabilities);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  return {
    capabilities,
    ready: !loading && ready
  };
}
