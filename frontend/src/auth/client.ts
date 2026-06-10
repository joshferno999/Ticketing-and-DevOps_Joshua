import type { AppSessionUser } from "@emergence-devops/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_BASE_URL environment variable is not configured. " +
    "Please set it in frontend/.env (e.g., VITE_API_BASE_URL=http://localhost:4000/api)"
  );
}

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Request failed with status ${response.status}`);
  }

  return payload as T;
}

export const authClient = {
  signUp: {
    email(input: { email: string; password: string; name?: string; callbackURL?: string }) {
      return readJson("/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          name: input.name
        })
      });
    }
  },
  signIn: {
    email(input: { email: string; password: string }) {
      return readJson("/auth/sign-in", {
        method: "POST",
        body: JSON.stringify(input)
      });
    }
  },
  signOut() {
    return readJson("/auth/sign-out", {
      method: "POST",
      body: JSON.stringify({})
    });
  },
  getSession() {
    return readJson<{ user: AppSessionUser }>("/auth/me", {
      method: "GET",
      headers: {}
    });
  }
};
