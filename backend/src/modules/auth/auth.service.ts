import type { AppUser, PrismaClient } from "@prisma/client";
import { parse, serialize } from "cookie";
import crypto from "node:crypto";

const SESSION_COOKIE_NAME = "emergence_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

interface AuthEnv {
  APP_AUTH_SECRET: string;
  NODE_ENV?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, expected] = passwordHash.split(":");
  if (!salt || !expected) {
    return false;
  }

  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function tokenHash(secret: string, token: string) {
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

function toSessionUser(appUser: AppUser): SessionUser {
  return {
    id: appUser.id,
    email: appUser.email,
    name: appUser.displayName ?? undefined,
    avatarUrl: appUser.asanaProfileImageUrl ?? undefined
  };
}

export function createAuthService(prisma: PrismaClient, env: AuthEnv) {
  async function createSession(appUserId: string) {
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await prisma.appSession.create({
      data: {
        tokenHash: tokenHash(env.APP_AUTH_SECRET, token),
        appUserId,
        expiresAt
      }
    });

    return {
      token,
      expiresAt
    };
  }

  async function getSession(cookieHeader?: string) {
    const cookies = parse(cookieHeader ?? "");
    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) {
      return null;
    }

    const session = await prisma.appSession.findUnique({
      where: {
        tokenHash: tokenHash(env.APP_AUTH_SECRET, token)
      },
      include: {
        appUser: true
      }
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await prisma.appSession.delete({
        where: {
          id: session.id
        }
      }).catch(() => undefined);
      return null;
    }

    return {
      session,
      appUser: session.appUser,
      user: toSessionUser(session.appUser)
    };
  }

  async function verifySession(headers: { cookie?: string }) {
    const session = await getSession(headers.cookie);
    if (!session) {
      throw new Error("Missing app session");
    }

    return session;
  }

  async function destroySession(cookieHeader?: string) {
    const cookies = parse(cookieHeader ?? "");
    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) {
      return;
    }

    await prisma.appSession.deleteMany({
      where: {
        tokenHash: tokenHash(env.APP_AUTH_SECRET, token)
      }
    });
  }

  function createSessionCookie(token: string, expiresAt: Date) {
    return serialize(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt
    });
  }

  function clearSessionCookie() {
    return serialize(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0)
    });
  }

  return {
    hashPassword,
    verifyPassword,
    createSession,
    getSession,
    verifySession,
    destroySession,
    createSessionCookie,
    clearSessionCookie
  };
}
