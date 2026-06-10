/**
 * BuildTrack — Module hierarchy routes
 */
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../modules/auth/auth.plugin";

export async function registerBuildTrackModuleRoutes(app: FastifyInstance) {
  // Get full module tree
  app.get("/bt/modules", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.post("/bt/modules", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.patch("/bt/modules/:id", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Archive (soft delete)
  app.delete("/bt/modules/:id", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });
}
