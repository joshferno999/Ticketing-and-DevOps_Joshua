import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { getErrorMessage, getErrorStatusCode } from "../lib/errors";
import { requireAuth } from "../modules/auth/auth.plugin";
import { createRepositoryCommitGraphService } from "../modules/github/repository-commit-graph.service";

const commitGraphQuerySchema = z.object({
  scope: z.enum(["all", "branch"]).default("all"),
  branch: z.string().min(1).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(60)
});

const pullRequestQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const taskLinkBodySchema = z.object({
  cardIds: z.array(z.string().min(1)).default([])
});

function handleRepositoryRouteError(reply: FastifyReply, error: unknown) {
  const statusCode = getErrorStatusCode(error);
  if (statusCode) {
    return reply.code(statusCode).send({
      message: getErrorMessage(error)
    });
  }

  throw error;
}

export async function registerRepositoryRoutes(app: FastifyInstance) {
  const commitGraphService = createRepositoryCommitGraphService(app.prisma, app.githubService);

  app.get("/repositories/:repositoryId/commit-graph", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { repositoryId } = request.params as { repositoryId: string };
      const query = commitGraphQuerySchema.parse(request.query ?? {});
      if (query.scope === "branch" && !query.branch) {
        return reply.badRequest("A branch name is required when scope=branch.");
      }

      const payload = await commitGraphService.getRepositoryCommitGraph(
        request.appUser!.id,
        repositoryId,
        query.scope,
        query.branch,
        query.offset,
        query.limit
      );

      return {
        data: payload
      };
    } catch (error) {
      return handleRepositoryRouteError(reply, error);
    }
  });

  app.get("/repositories/:repositoryId/pull-requests", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { repositoryId } = request.params as { repositoryId: string };
      const query = pullRequestQuerySchema.parse(request.query ?? {});
      const payload = await commitGraphService.getRepositoryPullRequests(
        request.appUser!.id,
        repositoryId,
        query.offset,
        query.limit
      );

      return {
        data: payload
      };
    } catch (error) {
      return handleRepositoryRouteError(reply, error);
    }
  });

  app.get("/repositories/:repositoryId/commits/search", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { repositoryId } = request.params as { repositoryId: string };
      const query = z.object({
        q: z.string().default(""),
        limit: z.coerce.number().int().min(1).max(7).default(7)
      }).parse(request.query ?? {});
      const trimmedQuery = query.q.trim();

      if (trimmedQuery.length < 2 && !/^[0-9a-f]{7,40}$/i.test(trimmedQuery.replace(/^\^/, ""))) {
        return reply.badRequest("Enter at least 2 characters or a 7+ character commit SHA.");
      }

      const payload = await commitGraphService.searchRepositoryCommits(
        request.appUser!.id,
        repositoryId,
        trimmedQuery,
        query.limit
      );

      return {
        data: payload
      };
    } catch (error) {
      return handleRepositoryRouteError(reply, error);
    }
  });

  app.get("/repositories/:repositoryId/commits/:sha", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { repositoryId, sha } = z.object({
        repositoryId: z.string().min(1),
        sha: z.string().min(7)
      }).parse(request.params);

      const payload = await commitGraphService.getRepositoryCommitBySha(
        request.appUser!.id,
        repositoryId,
        sha
      );

      return {
        data: payload
      };
    } catch (error) {
      return handleRepositoryRouteError(reply, error);
    }
  });

  app.get("/repositories/:repositoryId/tasks/search", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { repositoryId } = request.params as { repositoryId: string };
      const query = z.object({ q: z.string().default("") }).parse(request.query ?? {});
      const payload = await commitGraphService.searchRepositoryTasks(request.appUser!.id, repositoryId, query.q);

      return {
        data: payload
      };
    } catch (error) {
      return handleRepositoryRouteError(reply, error);
    }
  });

  app.get("/repositories/:repositoryId/commits/:sha/task-links", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { repositoryId, sha } = z.object({
        repositoryId: z.string().min(1),
        sha: z.string().min(1)
      }).parse(request.params);

      const payload = await commitGraphService.getCommitTaskLinks(request.appUser!.id, repositoryId, sha);
      if (!payload) {
        return reply.notFound("Commit not found or repository no longer granted.");
      }

      return {
        data: payload
      };
    } catch (error) {
      return handleRepositoryRouteError(reply, error);
    }
  });

  app.put("/repositories/:repositoryId/commits/:sha/task-links", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { repositoryId, sha } = z.object({
        repositoryId: z.string().min(1),
        sha: z.string().min(1)
      }).parse(request.params);
      const body = taskLinkBodySchema.parse(request.body ?? {});

      const payload = await commitGraphService.replaceCommitTaskLinks(
        request.appUser!.id,
        repositoryId,
        sha,
        body.cardIds
      );
      if (!payload) {
        return reply.notFound("Commit not found or repository no longer granted.");
      }

      return {
        data: payload
      };
    } catch (error) {
      return handleRepositoryRouteError(reply, error);
    }
  });

  app.get("/repositories/:repositoryId/pull-requests/:pullRequestNumber/task-links", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { repositoryId, pullRequestNumber } = z.object({
        repositoryId: z.string().min(1),
        pullRequestNumber: z.coerce.number().int().positive()
      }).parse(request.params);

      const payload = await commitGraphService.getPullRequestTaskLinks(
        request.appUser!.id,
        repositoryId,
        pullRequestNumber
      );
      if (!payload) {
        return reply.notFound("Pull request not found or repository no longer granted.");
      }

      return {
        data: payload
      };
    } catch (error) {
      return handleRepositoryRouteError(reply, error);
    }
  });

  app.put("/repositories/:repositoryId/pull-requests/:pullRequestNumber/task-links", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { repositoryId, pullRequestNumber } = z.object({
        repositoryId: z.string().min(1),
        pullRequestNumber: z.coerce.number().int().positive()
      }).parse(request.params);
      const body = taskLinkBodySchema.parse(request.body ?? {});

      const payload = await commitGraphService.replacePullRequestTaskLinks(
        request.appUser!.id,
        repositoryId,
        pullRequestNumber,
        body.cardIds
      );
      if (!payload) {
        return reply.notFound("Pull request not found or repository no longer granted.");
      }

      return {
        data: payload
      };
    } catch (error) {
      return handleRepositoryRouteError(reply, error);
    }
  });
}
