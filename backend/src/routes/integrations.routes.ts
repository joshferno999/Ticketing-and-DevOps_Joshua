import type { FastifyInstance } from "fastify";
import { createAsanaService } from "../modules/asana/asana.service";
import { requireAuth } from "../modules/auth/auth.plugin";
import {
  createGitHubInstallationService,
  mapInstallationRecord
} from "../modules/github/github.installation.service";

export async function registerIntegrationDataRoutes(app: FastifyInstance) {
  const asanaService = createAsanaService(app.prisma, app.config);
  const githubInstallationService = createGitHubInstallationService(app.prisma, app.githubService);

  app.get("/integrations/status", { preHandler: requireAuth }, async (request) => {
    const appUserId = request.appUser!.id;
    const appUser = await app.prisma.appUser.findUnique({
      where: {
        id: appUserId
      }
    });

    await githubInstallationService.linkUserToAllWorkspaceInstallations(appUserId);

    const workspaceInstallations = await githubInstallationService.listWorkspaceInstallations();

    const workspaces = appUser?.asanaAccessTokenEncrypted
      ? await asanaService.getWorkspaceMetadataForUser(request.appUser!.id, app.asanaClientFactory)
      : [];

    const githubConnected = workspaceInstallations.length > 0;
    const asanaConnected = Boolean(appUser?.asanaAccessTokenEncrypted);

    return {
      auth: {
        connected: true,
        user: request.user
      },
      capabilities: {
        canEditBoards: asanaConnected,
        canAccessRepos: githubConnected
      },
      github: {
        connected: githubConnected,
        installations: workspaceInstallations.map(mapInstallationRecord)
      },
      asana: {
        connected: asanaConnected,
        workspaceName: workspaces[0]?.name
      }
    };
  });

  app.post("/integrations/asana/profile/sync", { preHandler: requireAuth }, async (request, reply) => {
    const identity = await asanaService.syncUserIdentity(request.appUser!.id, app.asanaClientFactory);
    if (!identity) {
      return reply.notFound("No Asana connection found");
    }

    const refreshedUser = await app.prisma.appUser.findUnique({
      where: {
        id: request.appUser!.id
      }
    });

    if (!refreshedUser) {
      return reply.notFound("User not found");
    }

    return {
      user: app.appUserService.toSessionUser(refreshedUser)
    };
  });

  app.get("/integrations/asana/tasks/search", { preHandler: requireAuth }, async (request) => {
    const query = String((request.query as { q?: string }).q ?? "");
    return {
      data: await asanaService.searchParentTasksForUser(request.appUser!.id, app.asanaClientFactory, query)
    };
  });

  app.get("/integrations/asana/workspaces", { preHandler: requireAuth }, async (request, reply) => {
    const client = await asanaService.createAuthorizedClientForUser(request.appUser!.id, app.asanaClientFactory);
    if (!client) {
      return reply.notFound("No Asana connection found");
    }

    const response = await client.workspaces.getWorkspaces({
      limit: 50
    });

    return {
      data: response.data?.map((workspace: any) => ({
        gid: workspace.gid,
        name: workspace.name
      })) ?? []
    };
  });

  app.get("/integrations/asana/projects/:workspaceGid", { preHandler: requireAuth }, async (request, reply) => {
    const { workspaceGid } = request.params as { workspaceGid: string };
    const client = await asanaService.createAuthorizedClientForUser(request.appUser!.id, app.asanaClientFactory);
    if (!client) {
      return reply.notFound("No Asana connection found");
    }

    const response = await client.projects.getProjects({
      workspace: workspaceGid,
      limit: 50
    });

    return {
      data: response.data?.map((project: any) => ({
        gid: project.gid,
        name: project.name
      })) ?? []
    };
  });
}
