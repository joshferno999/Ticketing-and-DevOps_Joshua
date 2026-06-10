import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./config/env";
import { registerRoutes } from "./routes";
import { prisma } from "./db/prisma";
import { createAuthService } from "./modules/auth/auth.service";
import { createAsanaClientFactory } from "./modules/asana/asana.client";
import { createBridgeService } from "./modules/boards/bridge.service";
import { createGitHubService } from "./modules/github/github.service";
import { createAppUserService } from "./modules/auth/app-user.service";

declare module "fastify" {
  interface FastifyInstance {
    config: typeof env;
    prisma: typeof prisma;
    authService: ReturnType<typeof createAuthService>;
    appUserService: ReturnType<typeof createAppUserService>;
    asanaClientFactory: ReturnType<typeof createAsanaClientFactory>;
    githubService: ReturnType<typeof createGitHubService>;
    bridgeService: ReturnType<typeof createBridgeService>;
  }
}

export async function buildApp() {
  const app = Fastify({
    trustProxy: true,
    logger: {
      transport: process.env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: { translateTime: "HH:MM:ss Z", colorize: true }
          }
        : undefined
    }
  });

  app.decorate("config", env);
  app.decorate("prisma", prisma);
  app.decorate("authService", createAuthService(prisma, env));
  app.decorate("appUserService", createAppUserService(prisma));
  app.decorate("asanaClientFactory", createAsanaClientFactory(env));
  app.decorate("githubService", createGitHubService(env));
  app.decorate("bridgeService", createBridgeService());

  await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true
  });
  await app.register(sensible);
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Emergence Devops API",
        version: "0.1.0"
      }
    }
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  await registerRoutes(app);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
}
