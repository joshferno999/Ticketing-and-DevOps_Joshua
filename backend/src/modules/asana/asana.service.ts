import type { PrismaClient } from "@prisma/client";
import { decryptValue } from "../../lib/crypto";
import type { createAsanaClientFactory } from "./asana.client";
import { createAsanaOAuthService } from "./asana.oauth.service";

type AsanaClientFactory = ReturnType<typeof createAsanaClientFactory>;
type AsanaServiceEnv = {
  APP_AUTH_SECRET: string;
  ASANA_CLIENT_ID: string;
  ASANA_CLIENT_SECRET: string;
  ASANA_REDIRECT_URI: string;
};

export interface AsanaParentTaskSearchResult {
  gid: string;
  name: string;
  workspaceName: string;
  projectName?: string;
  completed: boolean;
}

export interface AsanaUserIdentity {
  asanaUserGid?: string;
  displayName?: string;
  avatarUrl?: string;
}

interface AsanaUserInfoResponse {
  sub?: string;
  name?: string;
  picture?: string;
}

interface AsanaCurrentUserResponse {
  data?: {
    gid?: string | number;
    name?: string;
    photo?: {
      image_128x128?: string | null;
    } | null;
  };
}

export function createAsanaService(prisma: PrismaClient, env: AsanaServiceEnv) {
  const oauthService = createAsanaOAuthService(prisma, env);

  async function getConnectionForUser(userId: string) {
    return prisma.appUser.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        asanaAccessTokenEncrypted: true,
        asanaRefreshTokenEncrypted: true,
        asanaTokenExpiresAt: true
      }
    });
  }

  async function getDecryptedConnectionForUser(userId: string) {
    const appUser = await getConnectionForUser(userId);
    if (!appUser?.asanaAccessTokenEncrypted || !appUser.asanaRefreshTokenEncrypted || !appUser.asanaTokenExpiresAt) {
      return null;
    }

    return {
      accessToken: decryptValue(appUser.asanaAccessTokenEncrypted, env.APP_AUTH_SECRET),
      refreshToken: decryptValue(appUser.asanaRefreshTokenEncrypted, env.APP_AUTH_SECRET),
      expiresAt: appUser.asanaTokenExpiresAt
    };
  }

  async function createAuthorizedClientForUser(userId: string, factory: AsanaClientFactory) {
    const connection = await ensureFreshConnectionForUser(userId);
    if (!connection) {
      return null;
    }

    return factory.fromAccessToken(connection.accessToken);
  }

  async function ensureFreshConnectionForUser(userId: string) {
    const connection = await getDecryptedConnectionForUser(userId);
    if (!connection) {
      return null;
    }

    const refreshThresholdMs = 60 * 1000;
    if (connection.expiresAt.getTime() - Date.now() > refreshThresholdMs) {
      return connection;
    }

    const refreshed = await oauthService.refreshAccessToken(connection.refreshToken);
    const refreshToken = refreshed.refresh_token ?? connection.refreshToken;
    await oauthService.persistConnection(userId, refreshed, connection.refreshToken);

    return {
      accessToken: refreshed.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000)
    };
  }

  async function syncUserIdentity(userId: string, factory: AsanaClientFactory): Promise<AsanaUserIdentity | null> {
    const connection = await ensureFreshConnectionForUser(userId);
    if (!connection) {
      return null;
    }

    const client = factory.fromAccessToken(connection.accessToken);
    const [me, userInfo] = await Promise.all([
      getCurrentAsanaUser(client),
      fetchAsanaUserInfo(connection.accessToken)
    ]);

    const asanaUserGid = me.data?.gid ? String(me.data.gid) : undefined;
    const displayName = normalizeOptionalString(userInfo?.name) ?? normalizeOptionalString(me.data?.name);
    const avatarUrl = normalizeOptionalString(userInfo?.picture) ?? normalizeOptionalString(me.data?.photo?.image_128x128);

    const updatedUser = await prisma.appUser.update({
      where: {
        id: userId
      },
      data: {
        ...(displayName ? { displayName } : {}),
        asanaUserGid: asanaUserGid ?? null,
        asanaProfileImageUrl: avatarUrl ?? null
      }
    });

    return {
      asanaUserGid: updatedUser.asanaUserGid ?? undefined,
      displayName: updatedUser.displayName ?? undefined,
      avatarUrl: updatedUser.asanaProfileImageUrl ?? undefined
    };
  }

  async function getWorkspaceMetadataForUser(userId: string, factory: AsanaClientFactory) {
    const client = await createAuthorizedClientForUser(userId, factory);
    if (!client) {
      return [];
    }

    const response = await client.workspaces.getWorkspaces({
      limit: 50,
      opt_fields: "gid,name"
    });

    return (response.data ?? []).map((workspace: any) => ({
      gid: String(workspace.gid),
      name: String(workspace.name ?? "")
    }));
  }

  async function searchParentTasksForUser(userId: string, factory: AsanaClientFactory, query: string): Promise<AsanaParentTaskSearchResult[]> {
    const client = await createAuthorizedClientForUser(userId, factory);
    if (!client) {
      return [];
    }

    const workspaces = await getWorkspaceMetadataForUser(userId, factory);
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const taskResponses = await Promise.all(
      workspaces.map(async (workspace: { gid: string; name: string }) => {
        const response = await client.tasks.searchTasksForWorkspace(workspace.gid, {
          text: trimmedQuery,
          completed: false,
          is_subtask: false,
          sort_by: "modified_at",
          sort_ascending: false,
          opt_fields: "gid,name,completed,projects.name,workspace.name"
        });

        return (response.data ?? []).map((task: any) => ({
          gid: String(task.gid),
          name: String(task.name ?? ""),
          workspaceName: String(task.workspace?.name ?? workspace.name),
          projectName: Array.isArray(task.projects) && task.projects.length > 0 ? String(task.projects[0].name ?? "") : undefined,
          completed: Boolean(task.completed)
        }));
      })
    );

    const deduped = new Map<string, AsanaParentTaskSearchResult>();
    for (const task of taskResponses.flat()) {
      if (!deduped.has(task.gid)) {
        deduped.set(task.gid, task);
      }
    }

    return Array.from(deduped.values());
  }

  return {
    getConnectionForUser,
    getDecryptedConnectionForUser,
    ensureFreshConnectionForUser,
    createAuthorizedClientForUser,
    syncUserIdentity,
    getWorkspaceMetadataForUser,
    searchParentTasksForUser
  };
}

async function fetchAsanaUserInfo(accessToken: string): Promise<AsanaUserInfoResponse | null> {
  const response = await fetch("https://app.asana.com/api/1.0/openid_connect/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Asana user info request failed with status ${response.status}`);
  }

  return (await response.json()) as AsanaUserInfoResponse;
}

async function getCurrentAsanaUser(client: Awaited<ReturnType<AsanaClientFactory["fromAccessToken"]>>): Promise<AsanaCurrentUserResponse> {
  try {
    return await client.users.getUser("me", {
      opt_fields: "gid,name,photo.image_128x128"
    }) as AsanaCurrentUserResponse;
  } catch {
    return await client.users.getUser("me", {
      opt_fields: "gid,name"
    }) as AsanaCurrentUserResponse;
  }
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
