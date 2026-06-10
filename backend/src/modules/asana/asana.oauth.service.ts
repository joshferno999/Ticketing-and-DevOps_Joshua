import type { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { encryptValue } from "../../lib/crypto";

interface AsanaEnv {
  ASANA_CLIENT_ID: string;
  ASANA_CLIENT_SECRET: string;
  ASANA_REDIRECT_URI: string;
  APP_AUTH_SECRET: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export function createAsanaOAuthService(prisma: PrismaClient, env: AsanaEnv) {
  async function exchangeCodeForToken(code: string) {
    return requestToken({
      grant_type: "authorization_code",
      client_id: env.ASANA_CLIENT_ID,
      client_secret: env.ASANA_CLIENT_SECRET,
      redirect_uri: env.ASANA_REDIRECT_URI,
      code
    });
  }

  async function refreshAccessToken(refreshToken: string) {
    return requestToken({
      grant_type: "refresh_token",
      client_id: env.ASANA_CLIENT_ID,
      client_secret: env.ASANA_CLIENT_SECRET,
      refresh_token: refreshToken
    });
  }

  async function requestToken(params: Record<string, string>) {
    const response = await fetch("https://app.asana.com/-/oauth_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(params)
    });

    if (!response.ok) {
      throw new Error(`Asana token exchange failed with status ${response.status}`);
    }

    return (await response.json()) as TokenResponse;
  }

  async function persistConnection(appUserId: string, tokenResponse: TokenResponse, existingRefreshToken?: string) {
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
    const refreshToken = tokenResponse.refresh_token ?? existingRefreshToken;

    if (!refreshToken) {
      throw new Error("Asana token response did not include a refresh token and no existing refresh token was available");
    }

    return prisma.appUser.update({
      where: {
        id: appUserId
      },
      data: {
        asanaAccessTokenEncrypted: encryptValue(tokenResponse.access_token, env.APP_AUTH_SECRET),
        asanaRefreshTokenEncrypted: encryptValue(refreshToken, env.APP_AUTH_SECRET),
        asanaTokenExpiresAt: expiresAt
      }
    });
  }

  async function createState(appUserId: string, returnTo?: string) {
    const nonce = crypto.randomUUID();
    const timestamp = Date.now();
    const safeReturnTo = returnTo?.startsWith("/") ? returnTo : undefined;
    await prisma.auditEvent.create({
      data: {
        actorId: appUserId,
        action: "asana.oauth.state.created",
        entityType: "asana_connection",
        entityId: nonce,
        metadata: {
          nonce,
          timestamp,
          used: false,
          returnTo: safeReturnTo
        }
      }
    });

    return Buffer.from(JSON.stringify({ appUserId, nonce, timestamp, returnTo: safeReturnTo })).toString("base64url");
  }

  function parseState(state: string): { appUserId: string; nonce: string; timestamp: number; returnTo?: string } | null {
    try {
      return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
        appUserId: string;
        nonce: string;
        timestamp: number;
        returnTo?: string;
      };
    } catch {
      return null;
    }
  }

  async function validateState(appUserId: string, nonce: string, timestamp: number) {
    const tenMinutesMs = 10 * 60 * 1000;
    if (Date.now() - timestamp > tenMinutesMs) {
      return false;
    }

    const record = await prisma.auditEvent.findFirst({
      where: {
        actorId: appUserId,
        action: "asana.oauth.state.created",
        entityId: nonce
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!record) {
      return false;
    }

    const metadata = record.metadata as { used?: boolean };
    if (metadata.used) {
      return false;
    }

    await prisma.auditEvent.update({
      where: { id: record.id },
      data: {
        metadata: {
          ...metadata,
          used: true,
          usedAt: Date.now()
        }
      }
    });

    return true;
  }

  return {
    exchangeCodeForToken,
    refreshAccessToken,
    persistConnection,
    createState,
    validateState,
    parseState
  };
}
