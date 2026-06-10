import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildGitHubSetupCallbackUrl, resolvePublicAppUrl } from "../../lib/public-app-url";
import { requireAuth } from "../auth/auth.plugin";
import { createAsanaOAuthService } from "../asana/asana.oauth.service";
import { createAsanaService } from "../asana/asana.service";
import {
  buildInstallationPayloadFromDetails,
  createGitHubInstallationService,
  mapInstallationRecord
} from "../github/github.installation.service";

export async function registerIntegrationRoutes(app: FastifyInstance) {
  const asanaOAuthService = createAsanaOAuthService(app.prisma, app.config);
  const githubInstallationService = createGitHubInstallationService(app.prisma, app.githubService);

  function frontendUrl(request?: FastifyRequest) {
    return resolvePublicAppUrl(app.config.FRONTEND_URL, request);
  }

  function redirectToFrontend(request: FastifyRequest, path: string) {
    const redirectUrl = new URL(path, frontendUrl(request));
    return redirectUrl.toString();
  }

  app.get("/integrations/asana/authorize", { preHandler: requireAuth }, async (request) => {
    const returnTo = typeof (request.query as { returnTo?: string } | undefined)?.returnTo === "string"
      ? (request.query as { returnTo?: string }).returnTo
      : undefined;
    const state = await asanaOAuthService.createState(request.appUser!.id, returnTo);

    // Omit scope so Asana uses the app's configured permissions (e.g. Full permissions).
    // Requesting granular scopes here fails with forbidden_scopes unless each scope is
    // explicitly enabled under OAuth → Permission scopes in the developer console.
    return {
      url: app.asanaClientFactory.getAuthorizationUrl(state)
    };
  });

  app.get("/integrations/asana/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string };
    const parsedState = query.state ? asanaOAuthService.parseState(query.state) : null;
    const appUserId = parsedState?.appUserId;

    if (!query.code || !parsedState || !appUserId || !parsedState.timestamp) {
      return reply.redirect(redirectToFrontend(request, "/settings?integration=asana&status=missing_params"));
    }

    const stateIsValid = await asanaOAuthService.validateState(appUserId, parsedState.nonce, parsedState.timestamp);
    if (!stateIsValid) {
      return reply.redirect(redirectToFrontend(request, "/settings?integration=asana&status=invalid_state"));
    }

    const tokenResponse = await asanaOAuthService.exchangeCodeForToken(query.code);
    await asanaOAuthService.persistConnection(appUserId, tokenResponse);

    const asanaService = createAsanaService(app.prisma, app.config);
    await asanaService.syncUserIdentity(appUserId, app.asanaClientFactory);

    const safeReturnTo = parsedState.returnTo?.startsWith("/") ? parsedState.returnTo : "/settings?section=asana";
    const redirectUrl = new URL(safeReturnTo, frontendUrl(request));
    redirectUrl.searchParams.set("integration", "asana");
    redirectUrl.searchParams.set("status", "connected");

    return reply.redirect(redirectUrl.toString());
  });

  app.get("/integrations/github/install-url", { preHandler: requireAuth }, async (request) => {
    const metadata = await app.githubService.getAppMetadata();
    if (!metadata?.slug) {
      throw new Error("GitHub App slug was not returned by the API");
    }

    const verifiedSession = await app.authService.verifySession({
      cookie: request.headers.cookie
    });
    const returnTo = typeof (request.query as { returnTo?: string } | undefined)?.returnTo === "string"
      ? (request.query as { returnTo?: string }).returnTo
      : undefined;
    const state = app.githubService.createInstallState({
      appUserId: request.appUser!.id,
      sessionId: verifiedSession.session.id,
      returnTo
    });
    const installUrl = `https://github.com/apps/${metadata.slug}/installations/new?state=${encodeURIComponent(state)}`;
    const publicAppUrl = frontendUrl(request);
    const workspaceInstallations = await githubInstallationService.listWorkspaceInstallations();

    return {
      url: installUrl,
      setupCallbackUrl: buildGitHubSetupCallbackUrl(publicAppUrl),
      existingInstallations: workspaceInstallations.map(mapInstallationRecord),
      canLinkWorkspaceInstallations: workspaceInstallations.length > 0
    };
  });

  app.get("/integrations/github/setup", async (request, reply) => {
    const query = request.query as { installation_id?: string; state?: string };
    const installationId = Number(query.installation_id);
    const state = app.githubService.verifyInstallState(query.state);
    let appUserId = state?.appUserId;
    let returnTo = state?.returnTo;

    if (!Number.isFinite(installationId)) {
      return reply.redirect(redirectToFrontend(request, "/settings?integration=github&status=missing_installation"));
    }

    if (!state || !appUserId) {
      return reply.redirect(redirectToFrontend(request, "/settings?integration=github&status=invalid_state"));
    }

    const session = await app.prisma.appSession.findUnique({
      where: {
        id: state.sessionId
      }
    });

    if (!session || session.appUserId !== appUserId || session.expiresAt.getTime() <= Date.now()) {
      return reply.redirect(redirectToFrontend(request, "/settings?integration=github&status=invalid_state"));
    }

    const details = await app.githubService.getInstallationDetails(installationId);
    await githubInstallationService.persistInstallation(
      appUserId,
      buildInstallationPayloadFromDetails(installationId, details)
    );

    const safeReturnTo = returnTo?.startsWith("/") ? returnTo : "/settings?section=github";
    const redirectUrl = new URL(safeReturnTo, frontendUrl(request));
    redirectUrl.searchParams.set("integration", "github");
    redirectUrl.searchParams.set("status", "connected");

    return reply.redirect(redirectUrl.toString());
  });

  app.post("/integrations/github/sync", { preHandler: requireAuth }, async (request) => {
    const appUserId = request.appUser!.id;
    let discoveredInstallations = 0;

    try {
      const imported = await githubInstallationService.syncWorkspaceFromGitHub(appUserId);
      discoveredInstallations = imported.length;
    } catch (error) {
      request.log.warn({ err: error }, "GitHub workspace discovery sync failed");
    }

    let refreshedInstallations: Awaited<ReturnType<typeof githubInstallationService.refreshWorkspaceInstallationsFromGitHub>> = [];
    try {
      refreshedInstallations = await githubInstallationService.refreshWorkspaceInstallationsFromGitHub(appUserId);
    } catch (error) {
      request.log.warn({ err: error }, "GitHub workspace repository refresh failed");
    }

    const repositoryCount = refreshedInstallations.reduce(
      (total, installation) => total + installation.repositories.length,
      0
    );

    if (discoveredInstallations === 0 && refreshedInstallations.length === 0) {
      const linked = await githubInstallationService.linkUserToAllWorkspaceInstallations(appUserId);
      return {
        data: {
          synced: linked.length,
          source: "workspace" as const,
          repositoryCount: linked.reduce((total, installation) => total + installation.repositories.length, 0)
        }
      };
    }

    return {
      data: {
        synced: Math.max(discoveredInstallations, refreshedInstallations.length),
        source: discoveredInstallations > 0 ? ("github" as const) : ("workspace" as const),
        repositoryCount
      }
    };
  });
}
