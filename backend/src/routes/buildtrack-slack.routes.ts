/**
 * BuildTrack — Slack integration routes
 * /bug slash command skeleton — NOT live/published yet
 * Bolt SDK will be wired by Hari when the Slack app is configured
 */
import type { FastifyInstance } from "fastify";

export async function registerBuildTrackSlackRoutes(app: FastifyInstance) {
  /**
   * Slack slash command endpoint — /bug
   * Skeleton only: receives payload, logs it, returns acknowledgement.
   * DO NOT publish this endpoint or register the command in Slack until
   * SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET are configured.
   */
  app.post("/bt/slack/commands/bug", async (request, reply) => {
    // TODO: verify Slack signing secret before processing
    app.log.info({ body: request.body }, "[BuildTrack] /bug command received (skeleton)");
    return reply.code(200).send("BuildTrack /bug command is not live yet.");
  });

  /**
   * Slack events endpoint (challenge + event callbacks)
   * Skeleton: acknowledges challenge, logs all events.
   */
  app.post("/bt/slack/events", async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    // Respond to Slack URL verification challenge
    if (body?.type === "url_verification") {
      return reply.send({ challenge: body.challenge });
    }

    app.log.info({ body }, "[BuildTrack] Slack event received (skeleton)");
    return reply.code(200).send({ ok: true });
  });
}
