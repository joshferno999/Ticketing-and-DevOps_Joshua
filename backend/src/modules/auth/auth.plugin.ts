import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const auth = await request.server.authService.verifySession({
      cookie: request.headers.cookie
    });

    request.user = auth.user;
    request.appUser = auth.appUser;
  } catch {
    return reply.unauthorized("Missing or invalid app session");
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name?: string;
      avatarUrl?: string;
    };
    appUser?: {
      id: string;
      email: string;
      passwordHash: string;
      displayName: string | null;
      asanaProfileImageUrl: string | null;
      asanaAccessTokenEncrypted: string | null;
      asanaRefreshTokenEncrypted: string | null;
      asanaTokenExpiresAt: Date | null;
      asanaUserGid: string | null;
      githubAccessTokenEncrypted: string | null;
      githubRefreshTokenEncrypted: string | null;
      githubTokenExpiresAt: Date | null;
      githubInstallationId: bigint | null;
      githubAccountLogin: string | null;
      githubAccountType: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }
}
