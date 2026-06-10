/**
 * BuildTrack — Admin panel routes
 * PM + admin only
 */
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../modules/auth/auth.plugin";

export async function registerBuildTrackAdminRoutes(app: FastifyInstance) {
  // ── Admin config key-value store ──
  app.get("/bt/admin/config", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.put("/bt/admin/config/:key", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // ── Users ──
  app.get("/bt/admin/users", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.post("/bt/admin/users/invite", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.patch("/bt/admin/users/:id", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // ── Routing rules ──
  app.get("/bt/admin/routing-rules", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.post("/bt/admin/routing-rules", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.patch("/bt/admin/routing-rules/:id", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // ── PM assignment rules ──
  app.get("/bt/admin/pm-rules", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.post("/bt/admin/pm-rules", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // ── SLA thresholds ──
  app.get("/bt/admin/sla", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.put("/bt/admin/sla", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // ── Request templates ──
  app.get("/bt/admin/templates", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.post("/bt/admin/templates", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.patch("/bt/admin/templates/:id", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // ── Themes ──
  app.get("/bt/admin/themes", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.post("/bt/admin/themes", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.patch("/bt/admin/themes/:id", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });
}
