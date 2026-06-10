/**
 * BuildTrack — Analytics routes
 */
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../modules/auth/auth.plugin";

export async function registerBuildTrackAnalyticsRoutes(app: FastifyInstance) {
  // Summary cards (total tickets, open, SLA breach count, avg resolution)
  app.get("/bt/analytics/summary", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Ticket volume over time (by module, type, sponsor)
  app.get("/bt/analytics/volume", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Triage time: submission → PM approval
  app.get("/bt/analytics/triage-time", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Resolution time by priority tier
  app.get("/bt/analytics/resolution-time", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // SLA breach rate (P0–P3)
  app.get("/bt/analytics/sla-breach", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // Effort calibration: estimated vs actual
  app.get("/bt/analytics/effort-calibration", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });

  // AI recommendation accuracy (how often PM overrides)
  app.get("/bt/analytics/ai-accuracy", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({ message: "Not implemented" });
  });
}
