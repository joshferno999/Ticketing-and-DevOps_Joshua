import type { FastifyInstance } from "fastify";
import { createGitHubInstallationService } from "../modules/github/github.installation.service";
import { createGitHubWebhookService } from "../modules/webhooks/github-webhook.service";

export async function registerWebhookRoutes(app: FastifyInstance) {
  const webhookService = createGitHubWebhookService(app.prisma);
  const githubInstallationService = createGitHubInstallationService(app.prisma, app.githubService);

  app.post("/webhooks/github", {
    config: {
      rawBody: true
    }
  }, async (request, reply) => {
    const rawBody = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
    const event = String(request.headers["x-github-event"] ?? "unknown");
    const deliveryId = typeof request.headers["x-github-delivery"] === "string" ? request.headers["x-github-delivery"] : undefined;
    const signature = typeof request.headers["x-hub-signature-256"] === "string" ? request.headers["x-hub-signature-256"] : undefined;

    if (!app.githubService.verifyWebhookSignature(rawBody, signature)) {
      return reply.unauthorized("Invalid GitHub webhook signature");
    }

    await webhookService.persistDelivery(event, request.body, deliveryId);

    const payload = request.body as any;

    if (event === "push") {
      await webhookService.processPush(payload);
    }

    if (event === "create" && payload.ref_type === "branch") {
      await webhookService.processBranchCreated(payload);
    }

    if (event === "pull_request") {
      await webhookService.processPullRequest(payload);
    }

    if (event === "installation_repositories" || (event === "installation" && payload.action === "new_permissions_accepted")) {
      const installationId = Number(payload.installation?.id);
      if (Number.isFinite(installationId)) {
        try {
          await githubInstallationService.refreshInstallationByGithubId(installationId);
        } catch (error) {
          request.log.warn({ err: error, installationId }, "Failed to refresh GitHub installation repositories from webhook");
        }
      }
    }

    return reply.status(202).send({ accepted: true });
  });
}
