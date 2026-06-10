import type { FastifyInstance, FastifyReply } from "fastify";
import type {
  CreateCardCommentInput,
  MoveBoardCardInput,
  UpdateBoardCardAssigneeInput,
  UpdateBoardCardDueDateInput,
  UpdateBoardCardManualCompletionInput
} from "@emergence-devops/shared";
import { z } from "zod";
import { getErrorMessage, getErrorStatusCode } from "../lib/errors";
import { requireAuth } from "../modules/auth/auth.plugin";
import { createBoardsService } from "../modules/boards/boards.service";
import { createCardCommentsService } from "../modules/boards/card-comments.service";

function handleBoardRouteError(reply: FastifyReply, error: unknown) {
  const statusCode = getErrorStatusCode(error);
  if (statusCode) {
    return reply.code(statusCode).send({
      message: getErrorMessage(error)
    });
  }

  throw error;
}

export async function registerBoardRoutes(app: FastifyInstance) {
  const boardsService = createBoardsService(app.prisma, app.asanaClientFactory, app.config);
  const cardCommentsService = createCardCommentsService(app.prisma, app.asanaClientFactory, app.config);

  app.get("/boards", { preHandler: requireAuth }, async (request) => {
    return boardsService.listBoardsForUser(request.appUser!.id);
  });

  app.get("/workspace/users", { preHandler: requireAuth }, async () => {
    return boardsService.listWorkspaceUsers();
  });

  app.get("/boards/tasks/search", { preHandler: requireAuth }, async (request) => {
    const query = z.object({ q: z.string().default("") }).parse(request.query ?? {});

    return {
      data: await boardsService.searchBoardTasks(request.appUser!.id, query.q)
    };
  });

  app.post("/boards", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const body = z.object({
        parentTaskGid: z.string().min(1)
      }).parse(request.body);

      return await boardsService.createBoardForParentTask(request.appUser!.id, body.parentTaskGid);
    } catch (error) {
      return handleBoardRouteError(reply, error);
    }
  });

  app.post("/boards/:boardId/star", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const params = z.object({
        boardId: z.string().min(1)
      }).parse(request.params);

      return await boardsService.setStarredBoard(request.appUser!.id, params.boardId);
    } catch (error) {
      return handleBoardRouteError(reply, error);
    }
  });

  app.post("/boards/:boardId/cards", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const params = z.object({
        boardId: z.string().min(1)
      }).parse(request.params);
      const body = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        parentTaskGid: z.string().min(1).optional()
      }).parse(request.body);

      return await boardsService.createCardForBoard(request.appUser!.id, params.boardId, body);
    } catch (error) {
      return handleBoardRouteError(reply, error);
    }
  });

  app.post("/boards/:boardId/cards/:cardId/move", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const params = z.object({
        boardId: z.string(),
        cardId: z.string()
      }).parse(request.params);
      const body = z.object({
        targetColumnKey: z.string().min(1),
        dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      }).parse(request.body) satisfies MoveBoardCardInput;

      return await boardsService.moveCardWithinBoard(request.appUser!.id, params.boardId, params.cardId, body);
    } catch (error) {
      return handleBoardRouteError(reply, error);
    }
  });

  app.post("/boards/:boardId/cards/:cardId/due-date", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const params = z.object({
        boardId: z.string(),
        cardId: z.string()
      }).parse(request.params);
      const body = z.object({
        dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      }).parse(request.body) satisfies UpdateBoardCardDueDateInput;

      return await boardsService.updateCardDueDate(request.appUser!.id, params.boardId, params.cardId, body.dueOn);
    } catch (error) {
      return handleBoardRouteError(reply, error);
    }
  });

  app.post("/boards/:boardId/cards/:cardId/assignee", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const params = z.object({
        boardId: z.string(),
        cardId: z.string()
      }).parse(request.params);
      const body = z.object({
        assigneeAppUserId: z.union([z.string().min(1), z.null()])
      }).parse(request.body) satisfies UpdateBoardCardAssigneeInput;

      return await boardsService.updateCardAssignee(
        request.appUser!.id,
        params.boardId,
        params.cardId,
        body.assigneeAppUserId
      );
    } catch (error) {
      return handleBoardRouteError(reply, error);
    }
  });

  app.get("/boards/:boardId/cards/:cardId/comments", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const params = z.object({
        boardId: z.string(),
        cardId: z.string()
      }).parse(request.params);

      return await cardCommentsService.listCardComments(
        request.appUser!.id,
        params.boardId,
        params.cardId
      );
    } catch (error) {
      return handleBoardRouteError(reply, error);
    }
  });

  app.post("/boards/:boardId/cards/:cardId/comments", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const params = z.object({
        boardId: z.string(),
        cardId: z.string()
      }).parse(request.params);
      const body = z.object({
        body: z.string(),
        mentions: z.array(z.object({
          appUserId: z.string().min(1),
          start: z.number().int().min(0),
          length: z.number().int().min(1)
        })).default([])
      }).parse(request.body) satisfies CreateCardCommentInput;

      return await cardCommentsService.createCardComment(
        request.appUser!.id,
        params.boardId,
        params.cardId,
        body
      );
    } catch (error) {
      return handleBoardRouteError(reply, error);
    }
  });

  app.post("/boards/:boardId/cards/:cardId/manual-completion", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const params = z.object({
        boardId: z.string(),
        cardId: z.string()
      }).parse(request.params);
      const body = z.object({
        manualCompletion: z.boolean()
      }).parse(request.body) satisfies UpdateBoardCardManualCompletionInput;

      return await boardsService.updateCardManualCompletion(
        request.appUser!.id,
        params.boardId,
        params.cardId,
        body.manualCompletion
      );
    } catch (error) {
      return handleBoardRouteError(reply, error);
    }
  });

  app.post("/boards/:boardId/sync", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const params = z.object({
        boardId: z.string().min(1)
      }).parse(request.params);

      return await boardsService.syncBoard(request.appUser!.id, params.boardId);
    } catch (error) {
      return handleBoardRouteError(reply, error);
    }
  });
}
