/**
 * BuildTrack — Ticket routes
 * All endpoints return 501 Not Implemented until Phase 4+
 */
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../modules/auth/auth.plugin";

export async function registerBuildTrackTicketRoutes(app: FastifyInstance) {
  // List tickets (PM/Dev: all; Sponsor: own only)
  app.get("/bt/tickets", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Create standard ticket
  app.post("/bt/tickets", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Create sponsor build ticket
  app.post("/bt/tickets/build", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Get single ticket
  app.get("/bt/tickets/:id", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Update ticket (general)
  app.patch("/bt/tickets/:id", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Delete ticket (admin only)
  app.delete("/bt/tickets/:id", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // PM triage: set priority, category, refined task, assignee
  app.post("/bt/tickets/:id/triage", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Push ticket to Asana
  app.post("/bt/tickets/:id/push-asana", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Link GitHub PR to ticket
  app.post("/bt/tickets/:id/link-pr", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Update production gate (sr_engineer / admin only)
  app.post("/bt/tickets/:id/gate", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Update dev stage (picked_up / in_progress / blocked / done)
  app.post("/bt/tickets/:id/stage", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Comments
  app.get("/bt/tickets/:id/comments", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  app.post("/bt/tickets/:id/comments", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Audit event log
  app.get("/bt/tickets/:id/events", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Global search
  app.get("/bt/search", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });
}
