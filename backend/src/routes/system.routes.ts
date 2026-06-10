import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../modules/auth/auth.plugin";
import { createOnboardingService } from "../modules/onboarding/onboarding.service";

export async function registerSystemRoutes(app: FastifyInstance) {
  const onboardingService = createOnboardingService(app.prisma);

  app.get("/health", async () => ({
    status: "ok",
    service: "backend"
  }));

  app.post("/auth/sign-up", async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1).max(120).optional()
    }).parse(request.body);

    const existing = await app.appUserService.getByEmail(body.email);
    if (existing) {
      return reply.conflict("That email is already registered");
    }

    const appUser = await app.appUserService.createUser({
      email: body.email,
      passwordHash: app.authService.hashPassword(body.password),
      displayName: body.name
    });

    const session = await app.authService.createSession(appUser.id);
    reply.header("set-cookie", app.authService.createSessionCookie(session.token, session.expiresAt));

    return {
      user: app.appUserService.toSessionUser(appUser)
    };
  });

  app.post("/auth/sign-in", async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(1)
    }).parse(request.body);

    const appUser = await app.appUserService.getByEmail(body.email);
    if (!appUser || !app.authService.verifyPassword(body.password, appUser.passwordHash)) {
      return reply.unauthorized("Invalid email or password");
    }

    const session = await app.authService.createSession(appUser.id);
    reply.header("set-cookie", app.authService.createSessionCookie(session.token, session.expiresAt));

    return {
      user: app.appUserService.toSessionUser(appUser)
    };
  });

  app.post("/auth/sign-out", async (request, reply) => {
    await app.authService.destroySession(request.headers.cookie);
    reply.header("set-cookie", app.authService.clearSessionCookie());
    return {
      ok: true
    };
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (request) => ({
    user: request.user
  }));

  app.get("/onboarding/status", { preHandler: requireAuth }, async (request) => {
    const result = await onboardingService.getStatus(request.appUser!.id);
    return result.data;
  });
}
