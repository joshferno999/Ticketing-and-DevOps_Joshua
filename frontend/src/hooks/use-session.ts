import type { AppSessionUser } from "@emergence-devops/shared";
import { authClient } from "../auth/client";
import { subscribeToSessionUserUpdated } from "../lib/session-events";
import { useEffect, useState } from "react";

type SessionUser = AppSessionUser;

function resolveUser(data: any): SessionUser | null {
  const resolvedUser = data?.data?.user ?? data?.data?.session?.user ?? data?.user ?? data?.session?.user;
  if (!resolvedUser?.id || typeof resolvedUser.email !== "string") {
    return null;
  }

  return {
    id: resolvedUser.id,
    email: resolvedUser.email,
    name: resolvedUser.name ?? undefined,
    avatarUrl: resolvedUser.avatarUrl ?? undefined
  };
}

export function useSession() {
  const [state, setState] = useState<{
    loading: boolean;
    user: SessionUser | null;
  }>({
    loading: true,
    user: null
  });

  useEffect(() => {
    let active = true;

    authClient.getSession()
      .then((payload) => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          user: resolveUser(payload)
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          user: null
        });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => subscribeToSessionUserUpdated((user) => {
    setState((current) => ({
      loading: false,
      user: current.user?.id === user.id ? { ...current.user, ...user } : current.user
    }));
  }), []);

  return {
    loading: state.loading,
    user: state.user
  };
}
