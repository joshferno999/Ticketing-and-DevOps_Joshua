import type { AppSessionUser } from "@emergence-devops/shared";

const SESSION_USER_UPDATED_EVENT = "session:user-updated";

export function broadcastSessionUserUpdated(user: AppSessionUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<AppSessionUser>(SESSION_USER_UPDATED_EVENT, {
    detail: user
  }));
}

export function subscribeToSessionUserUpdated(listener: (user: AppSessionUser) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<AppSessionUser>).detail;
    if (detail?.id) {
      listener(detail);
    }
  };

  window.addEventListener(SESSION_USER_UPDATED_EVENT, handler);
  return () => window.removeEventListener(SESSION_USER_UPDATED_EVENT, handler);
}
