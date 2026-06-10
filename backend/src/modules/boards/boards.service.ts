import {
  canMarkCardComplete,
  CARD_COMPLETION_REQUIREMENT_MESSAGE,
  type BoardCard,
  type BoardSummary,
  type MoveBoardCardInput,
  type TaskLinkableCardSummary,
  type TaskSearchResult,
  type WorkspaceUserSummary
} from "@emergence-devops/shared";
import type { PrismaClient } from "@prisma/client";
import type { createAsanaClientFactory } from "../asana/asana.client";
import { createAsanaService } from "../asana/asana.service";
import { isAsanaWriteAccessFailure, toAsanaTaskWriteForbiddenError } from "../asana/asana-errors";
import { ForbiddenError, NotFoundError } from "../../lib/errors";
import type { ServiceResult } from "../../lib/result";

type AsanaClientFactory = ReturnType<typeof createAsanaClientFactory>;
type AuthorizedAsanaClient = ReturnType<AsanaClientFactory["fromAccessToken"]>;
type BoardsServiceEnv = {
  APP_AUTH_SECRET: string;
  ASANA_CLIENT_ID: string;
  ASANA_CLIENT_SECRET: string;
  ASANA_REDIRECT_URI: string;
};

const DEFAULT_COLUMNS = [
  { key: "backlog", name: "Backlog", color: "#61708a" },
  { key: "not_started", name: "Not Started", color: "#8b95a7" },
  { key: "active", name: "In Progress", color: "#0284c7" },
  { key: "review", name: "In PR", color: "#f59e0b" },
  { key: "done", name: "Done", color: "#10b981" }
] as const;

const SUBTASK_FIELDS = [
  "gid",
  "name",
  "notes",
  "due_on",
  "due_at",
  "completed",
  "assignee.gid",
  "assignee.name",
  "assignee.email",
  "modified_at",
  "tags.name"
].join(",");

const PARENT_TASK_FIELDS = [
  "gid",
  "name",
  "workspace.gid",
  "workspace.name",
  "completed",
  "projects.name"
].join(",");

const cardInclude = {
  developmentLinks: true,
  githubActivityLinks: {
    include: {
      activity: true
    }
  }
} as const;

type WorkspaceUserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  asanaProfileImageUrl: string | null;
  asanaUserGid: string | null;
};

export function createBoardsService(prisma: PrismaClient, asanaClientFactory: AsanaClientFactory, env: BoardsServiceEnv) {
  const asanaService = createAsanaService(prisma, env);

  async function listBoardsForUser(_userId: string): Promise<ServiceResult<BoardSummary[]>> {
    return {
      data: await getBoardsFromDb(),
      source: "database"
    };
  }

  async function setStarredBoard(_userId: string, boardId: string): Promise<ServiceResult<BoardSummary>> {
    await getBoardByIdOrThrow(boardId);

    await prisma.$transaction([
      prisma.board.updateMany({
        where: {
          isStarred: true
        },
        data: {
          isStarred: false
        }
      }),
      prisma.board.update({
        where: {
          id: boardId
        },
        data: {
          isStarred: true
        }
      })
    ]);

    return {
      data: await getBoardFromDb(boardId),
      source: "database"
    };
  }

  async function createBoardForParentTask(userId: string, parentTaskGid: string): Promise<ServiceResult<BoardSummary>> {
    const client = await requireAsanaClient(userId);
    const taskResponse = await client.tasks.getTask(parentTaskGid, {
      opt_fields: PARENT_TASK_FIELDS
    });
    const parentTask = taskResponse.data;

    const existingBoard = await prisma.board.findUnique({
      where: {
        asanaParentTaskGid: parentTaskGid
      }
    });

    const existingStarredBoard = existingBoard
      ? null
      : await prisma.board.findFirst({
          where: {
            isStarred: true
          },
          select: {
            id: true
          }
        });

    const board = existingBoard
      ? await prisma.board.update({
          where: {
            id: existingBoard.id
          },
          data: {
            name: String(parentTask.name ?? existingBoard.name),
            asanaWorkspaceName: String(parentTask.workspace?.name ?? existingBoard.asanaWorkspaceName),
            asanaProjectName: firstProjectName(parentTask.projects) ?? existingBoard.asanaProjectName
          }
        })
      : await prisma.board.create({
          data: {
            importedByAppUserId: userId,
            name: String(parentTask.name ?? "Unnamed parent task"),
            isStarred: !existingStarredBoard,
            asanaParentTaskGid: parentTaskGid,
            asanaWorkspaceName: String(parentTask.workspace?.name ?? "Unknown workspace"),
            asanaProjectName: firstProjectName(parentTask.projects) ?? "No linked project"
          }
        });

    await ensureDefaultColumns(board.id);
    await syncBoardFromAsana(userId, board.id, client);

    return {
      data: await getBoardFromDb(board.id),
      source: "database"
    };
  }

  async function createCardForBoard(userId: string, boardId: string, input: { title: string; description?: string; parentTaskGid?: string }): Promise<ServiceResult<BoardCard>> {
    const board = await getBoardForWrite(boardId, userId);

    const parentContext = await resolveParentContext(board.id, board.asanaParentTaskGid, input.parentTaskGid);
    const client = await requireAsanaClient(userId);
    const response = await client.tasks.createSubtaskForTask(
      {
        data: {
          name: input.title,
          notes: input.description ?? ""
        }
      },
      parentContext.parentTaskGid,
      {
        opt_fields: SUBTASK_FIELDS
      }
    );

    const subtask = response.data;
    const dueValues = parseAsanaDueValues(subtask);
    const workspaceUsers = await loadWorkspaceUsers();
    const assignee = resolveWorkspaceAssigneeFromAsana(subtask.assignee, workspaceUsers);
    const persistedCard = await prisma.card.upsert({
      where: {
        asanaTaskGid: String(subtask.gid)
      },
      update: {
        asanaParentTaskGid: parentContext.parentTaskGid,
        asanaRootTaskGid: board.asanaParentTaskGid,
        ancestryPath: parentContext.ancestryPath,
        nestingDepth: parentContext.nestingDepth,
        title: String(subtask.name ?? input.title),
        description: String(subtask.notes ?? input.description ?? ""),
        dueOn: dueValues.dueOn,
        dueAt: dueValues.dueAt,
        manualStatusKey: null,
        statusKey: determineStatusKey(Boolean(subtask.completed), dueValues.dueOn, null),
        assigneeName: assignee.assigneeName,
        assigneeAppUserId: assignee.assigneeAppUserId,
        tags: extractTagNames(subtask.tags),
        priority: null,
        updatedAt: parseAsanaDate(subtask.modified_at)
      },
      create: {
        boardId: board.id,
        asanaTaskGid: String(subtask.gid),
        asanaParentTaskGid: parentContext.parentTaskGid,
        asanaRootTaskGid: board.asanaParentTaskGid,
        ancestryPath: parentContext.ancestryPath,
        nestingDepth: parentContext.nestingDepth,
        title: String(subtask.name ?? input.title),
        description: String(subtask.notes ?? input.description ?? ""),
        dueOn: dueValues.dueOn,
        dueAt: dueValues.dueAt,
        manualStatusKey: null,
        statusKey: determineStatusKey(Boolean(subtask.completed), dueValues.dueOn, null),
        assigneeName: assignee.assigneeName,
        assigneeAppUserId: assignee.assigneeAppUserId,
        tags: extractTagNames(subtask.tags),
        priority: null,
        updatedAt: parseAsanaDate(subtask.modified_at)
      },
      include: cardInclude
    });

    return {
      data: mapCard(persistedCard),
      source: "database"
    };
  }

  async function moveCardWithinBoard(userId: string, boardId: string, cardId: string, input: MoveBoardCardInput) {
    const board = await getBoardForWrite(boardId, userId);

    const existingCard = await prisma.card.findFirst({
      where: {
        id: cardId,
        boardId: board.id
      },
      include: {
        developmentLinks: true,
        githubActivityLinks: {
          include: {
            activity: true
          }
        }
      }
    });

    if (!existingCard) {
      throw new Error("Card not found");
    }

    validateMoveTransition(input, mapCard(existingCard));

    const client = await requireAsanaClient(userId);
    let nextManualStatusKey: string | null = existingCard.manualStatusKey ?? null;
    let nextStatusKey = existingCard.statusKey;
    let nextDueOn = existingCard.dueOn;
    let nextDueAt = existingCard.dueAt;
    let nextAssigneeName = existingCard.assigneeName;
    let nextAssigneeAppUserId = existingCard.assigneeAppUserId;
    let nextUpdatedAt = new Date();

    const asanaUser = input.targetColumnKey === "active"
      ? await resolveAuthorizedAsanaUser(client)
      : null;
    const response = await updateBoardTaskInAsana(
      userId,
      board,
      existingCard.asanaTaskGid,
      {
        completed: input.targetColumnKey === "done",
        ...(input.targetColumnKey === "active"
          ? {
              due_on: input.dueOn,
              assignee: asanaUser?.gid
            }
          : {})
      }
    );

    const updatedTask = response.data;
    const dueValues = parseAsanaDueValues(updatedTask);
    const workspaceUsers = await loadWorkspaceUsers();
    const assignee = input.targetColumnKey === "active" && asanaUser
      ? resolveWorkspaceAssigneeFromAsana({ gid: asanaUser.gid, name: asanaUser.name }, workspaceUsers)
      : resolveWorkspaceAssigneeFromAsana(updatedTask.assignee, workspaceUsers);
    nextDueOn = dueValues.dueOn;
    nextDueAt = dueValues.dueAt;
    nextAssigneeName = assignee.assigneeName;
    nextAssigneeAppUserId = assignee.assigneeAppUserId;
    nextUpdatedAt = parseAsanaDate(updatedTask.modified_at);

    if (input.targetColumnKey === "backlog") {
      nextManualStatusKey = "backlog";
      nextStatusKey = "backlog";
    } else if (input.targetColumnKey === "done") {
      nextManualStatusKey = null;
      nextStatusKey = "done";
    } else if (input.targetColumnKey === "review") {
      nextManualStatusKey = "review";
      nextStatusKey = "review";
    } else {
      nextManualStatusKey = null;
      nextStatusKey = determineStatusKey(Boolean(updatedTask.completed), dueValues.dueOn, null);
    }

    const card = await prisma.card.update({
      where: {
        id: existingCard.id
      },
      data: {
        statusKey: nextStatusKey,
        manualStatusKey: nextManualStatusKey,
        dueOn: nextDueOn,
        dueAt: nextDueAt,
        assigneeName: nextAssigneeName,
        assigneeAppUserId: nextAssigneeAppUserId,
        updatedAt: nextUpdatedAt
      },
      include: cardInclude
    });

    return {
      data: mapCard(card),
      source: "database" as const
    };
  }

  async function updateCardDueDate(userId: string, boardId: string, cardId: string, dueOn: string) {
    const board = await getBoardForWrite(boardId, userId);

    const existingCard = await prisma.card.findFirst({
      where: {
        id: cardId,
        boardId: board.id
      }
    });

    if (!existingCard) {
      throw new Error("Card not found");
    }

    await requireAsanaClient(userId);
    const response = await updateBoardTaskInAsana(userId, board, existingCard.asanaTaskGid, {
      due_on: dueOn
    });

    const updatedTask = response.data;
    const dueValues = parseAsanaDueValues(updatedTask);
    const nextStatusKey = computeEditableCardStatus(existingCard, Boolean(updatedTask.completed), dueValues.dueOn);

    const card = await prisma.card.update({
      where: {
        id: existingCard.id
      },
      data: {
        dueOn: dueValues.dueOn,
        dueAt: dueValues.dueAt,
        assigneeName: updatedTask.assignee?.name ? String(updatedTask.assignee.name) : existingCard.assigneeName,
        statusKey: nextStatusKey,
        updatedAt: parseAsanaDate(updatedTask.modified_at)
      },
      include: {
        developmentLinks: true,
        githubActivityLinks: {
          include: {
            activity: true
          }
        }
      }
    });

    return {
      data: mapCard(card),
      source: "database" as const
    };
  }

  async function syncBoard(userId: string, boardId: string): Promise<ServiceResult<BoardSummary>> {
    await syncBoardFromAsana(userId, boardId);
    return {
      data: await getBoardFromDb(boardId),
      source: "database"
    };
  }

  async function listWorkspaceUsers(): Promise<ServiceResult<WorkspaceUserSummary[]>> {
    const users = await prisma.appUser.findMany({
      orderBy: {
        email: "asc"
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        asanaProfileImageUrl: true,
        asanaUserGid: true
      }
    });

    return {
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: formatUserDisplayName(user),
        avatarUrl: user.asanaProfileImageUrl ?? undefined,
        ...(user.asanaUserGid ? { asanaUserGid: user.asanaUserGid } : {}),
        mentionable: Boolean(user.asanaUserGid)
      })),
      source: "database"
    };
  }

  async function updateCardAssignee(
    actingUserId: string,
    boardId: string,
    cardId: string,
    assigneeAppUserId: string | null
  ): Promise<ServiceResult<BoardCard>> {
    const board = await prisma.board.findUnique({
      where: {
        id: boardId
      }
    });

    if (!board) {
      throw new NotFoundError("Board not found");
    }

    const existingCard = await prisma.card.findFirst({
      where: {
        id: cardId,
        boardId: board.id
      }
    });

    if (!existingCard) {
      throw new NotFoundError("Card not found");
    }

    let nextAssigneeAppUserId: string | null = null;
    let nextAssigneeName: string | null = null;

    if (assigneeAppUserId) {
      const assigneeUser = await prisma.appUser.findUnique({
        where: {
          id: assigneeAppUserId
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          asanaUserGid: true
        }
      });

      if (!assigneeUser) {
        throw new NotFoundError("Selected assignee is not a workspace member.");
      }

      nextAssigneeAppUserId = assigneeUser.id;
      nextAssigneeName = formatUserDisplayName(assigneeUser);
      await syncCardAssigneeToAsana(actingUserId, existingCard.asanaTaskGid, assigneeUser.asanaUserGid ?? null);
    } else {
      await syncCardAssigneeToAsana(actingUserId, existingCard.asanaTaskGid, null);
    }

    const card = await prisma.card.update({
      where: {
        id: existingCard.id
      },
      data: {
        assigneeAppUserId: nextAssigneeAppUserId,
        assigneeName: nextAssigneeName
      },
      include: cardInclude
    });

    return {
      data: mapCard(card),
      source: "database" as const
    };
  }

  async function updateCardManualCompletion(
    userId: string,
    boardId: string,
    cardId: string,
    manualCompletion: boolean
  ): Promise<ServiceResult<BoardCard>> {
    await getBoardForWrite(boardId, userId);

    const existingCard = await prisma.card.findFirst({
      where: {
        id: cardId,
        boardId
      }
    });

    if (!existingCard) {
      throw new NotFoundError("Card not found");
    }

    const card = await prisma.card.update({
      where: {
        id: existingCard.id
      },
      data: {
        manualCompletion
      },
      include: cardInclude
    });

    return {
      data: mapCard(card),
      source: "database" as const
    };
  }

  async function getBoardsFromDb() {
    const boardIds = await prisma.board.findMany({
      select: {
        id: true
      }
    });

    await Promise.all(boardIds.map((board) => ensureDefaultColumns(board.id)));

    const boards = await prisma.board.findMany({
      include: {
        boardColumnMappings: true,
        cards: {
          include: {
            developmentLinks: true,
            githubActivityLinks: {
              include: {
                activity: true
              }
            }
          }
        }
      },
      orderBy: [
        {
          isStarred: "desc"
        },
        {
          updatedAt: "desc"
        }
      ]
    });

    return boards.map(mapBoard);
  }

  async function getBoardFromDb(boardId: string) {
    const existingBoard = await getBoardByIdOrThrow(boardId);

    await ensureDefaultColumns(existingBoard.id);

    const board = await prisma.board.findUnique({
      where: {
        id: boardId
      },
      include: {
        boardColumnMappings: true,
        cards: {
          include: {
            developmentLinks: true,
            githubActivityLinks: {
              include: {
                activity: true
              }
            }
          }
        }
      }
    });

    if (!board) {
      throw new NotFoundError("Board not found");
    }

    return mapBoard(board);
  }

  async function getBoardForWrite(boardId: string, userId: string) {
    await assertAsanaConnected(userId);
    return getBoardByIdOrThrow(boardId);
  }

  async function getBoardByIdOrThrow(boardId: string) {
    const board = await prisma.board.findUnique({
      where: {
        id: boardId
      }
    });

    if (!board) {
      throw new NotFoundError("Board not found");
    }

    return board;
  }

  async function assertAsanaConnected(userId: string) {
    const client = await asanaService.createAuthorizedClientForUser(userId, asanaClientFactory);
    if (!client) {
      throw new ForbiddenError("Connect Asana in Settings to make changes.");
    }
  }

  async function syncBoardFromAsana(userId: string, boardId: string, existingClient?: Awaited<ReturnType<typeof asanaService.createAuthorizedClientForUser>>) {
    const board = await getBoardForWrite(boardId, userId);
    const client = existingClient ?? await requireAsanaClient(userId);
    await syncBoardCardsFromAsana(board.id, board.asanaParentTaskGid, client);
  }

  async function syncBoardCardsFromAsana(boardId: string, parentTaskGid: string, client: AuthorizedAsanaClient) {
    const board = await prisma.board.findUniqueOrThrow({
      where: {
        id: boardId
      },
      include: {
        cards: true
      }
    });

    const existingCardsByGid = new Map(board.cards.map((card) => [card.asanaTaskGid, card]));
    const workspaceUsers = await loadWorkspaceUsers();
    const subtasks = await collectDescendantSubtasks(client, parentTaskGid);
    const seenTaskGids = new Set<string>();

    for (const subtask of subtasks) {
      const taskGid = String(subtask.task.gid);
      seenTaskGids.add(taskGid);
      const existingCard = existingCardsByGid.get(taskGid);
      const dueValues = parseAsanaDueValues(subtask.task);
      const assignee = resolveWorkspaceAssigneeFromAsana(subtask.task.assignee, workspaceUsers);

      await prisma.card.upsert({
        where: {
          asanaTaskGid: taskGid
        },
        update: {
          asanaParentTaskGid: subtask.parentTaskGid,
          asanaRootTaskGid: parentTaskGid,
          ancestryPath: subtask.ancestryPath,
          nestingDepth: subtask.nestingDepth,
          title: String(subtask.task.name ?? existingCard?.title ?? "Untitled task"),
          description: String(subtask.task.notes ?? existingCard?.description ?? ""),
          dueOn: dueValues.dueOn,
          dueAt: dueValues.dueAt,
          manualStatusKey: existingCard?.manualStatusKey ?? null,
          manualCompletion: existingCard?.manualCompletion ?? false,
          statusKey: determineStatusKey(Boolean(subtask.task.completed), dueValues.dueOn, existingCard?.manualStatusKey ?? null),
          assigneeName: assignee.assigneeName,
          assigneeAppUserId: assignee.assigneeAppUserId,
          tags: extractTagNames(subtask.task.tags),
          priority: existingCard?.priority ?? null,
          updatedAt: parseAsanaDate(subtask.task.modified_at)
        },
        create: {
          boardId,
          asanaTaskGid: taskGid,
          asanaParentTaskGid: subtask.parentTaskGid,
          asanaRootTaskGid: parentTaskGid,
          ancestryPath: subtask.ancestryPath,
          nestingDepth: subtask.nestingDepth,
          title: String(subtask.task.name ?? "Untitled task"),
          description: String(subtask.task.notes ?? ""),
          dueOn: dueValues.dueOn,
          dueAt: dueValues.dueAt,
          manualStatusKey: null,
          statusKey: determineStatusKey(Boolean(subtask.task.completed), dueValues.dueOn, null),
          assigneeName: assignee.assigneeName,
          assigneeAppUserId: assignee.assigneeAppUserId,
          tags: extractTagNames(subtask.task.tags),
          priority: null,
          updatedAt: parseAsanaDate(subtask.task.modified_at)
        }
      });
    }

    const staleCards = board.cards.filter((card) => !seenTaskGids.has(card.asanaTaskGid));
    if (staleCards.length > 0) {
      await prisma.card.deleteMany({
        where: {
          id: {
            in: staleCards.map((card) => card.id)
          }
        }
      });
    }
  }

  async function requireAsanaClient(userId: string) {
    await assertAsanaConnected(userId);
    const client = await asanaService.createAuthorizedClientForUser(userId, asanaClientFactory);
    if (!client) {
      throw new ForbiddenError("Connect Asana in Settings to make changes.");
    }

    return client;
  }

  async function updateBoardTaskInAsana(
    actingUserId: string,
    board: { importedByAppUserId: string },
    asanaTaskGid: string,
    data: Record<string, unknown>
  ) {
    const primaryClient = await requireAsanaClient(actingUserId);

    try {
      return await primaryClient.tasks.updateTask(
        { data },
        asanaTaskGid,
        { opt_fields: SUBTASK_FIELDS }
      );
    } catch (error) {
      if (!isAsanaWriteAccessFailure(error)) {
        throw error;
      }

      const fallbackUserId = board.importedByAppUserId;
      if (fallbackUserId === actingUserId) {
        throw toAsanaTaskWriteForbiddenError();
      }

      const fallbackClient = await asanaService.createAuthorizedClientForUser(fallbackUserId, asanaClientFactory);
      if (!fallbackClient) {
        throw toAsanaTaskWriteForbiddenError();
      }

      try {
        return await fallbackClient.tasks.updateTask(
          { data },
          asanaTaskGid,
          { opt_fields: SUBTASK_FIELDS }
        );
      } catch (fallbackError) {
        if (isAsanaWriteAccessFailure(fallbackError)) {
          throw toAsanaTaskWriteForbiddenError();
        }

        throw fallbackError;
      }
    }
  }

  async function loadWorkspaceUsers(): Promise<WorkspaceUserRecord[]> {
    return prisma.appUser.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        asanaProfileImageUrl: true,
        asanaUserGid: true
      }
    });
  }

  async function syncCardAssigneeToAsana(actingUserId: string, asanaTaskGid: string, assigneeAsanaGid: string | null) {
    const client = await asanaService.createAuthorizedClientForUser(actingUserId, asanaClientFactory);
    if (!client) {
      return;
    }

    try {
      await client.tasks.updateTask(
        {
          data: {
            assignee: assigneeAsanaGid
          }
        },
        asanaTaskGid,
        {
          opt_fields: SUBTASK_FIELDS
        }
      );
    } catch {
      // Best-effort Asana sync; local workspace assignee is still persisted.
    }
  }

  async function ensureDefaultColumns(boardId: string) {
    const existingMappings = await prisma.boardColumnMapping.findMany({
      where: {
        boardId
      },
      select: {
        columnKey: true
      }
    });

    const existingKeys = new Set(existingMappings.map((mapping) => mapping.columnKey));
    const missingColumns = DEFAULT_COLUMNS.filter((column) => !existingKeys.has(column.key));
    if (missingColumns.length === 0) {
      return;
    }

    await prisma.boardColumnMapping.createMany({
      data: missingColumns.map((column) => ({
        boardId,
        columnKey: column.key,
        columnName: column.name,
        columnColor: column.color
      }))
    });
  }

  async function resolveParentContext(boardId: string, rootTaskGid: string, requestedParentTaskGid?: string) {
    if (!requestedParentTaskGid || requestedParentTaskGid === rootTaskGid) {
      return {
        parentTaskGid: rootTaskGid,
        ancestryPath: [] as string[],
        nestingDepth: 0
      };
    }

    const parentCard = await prisma.card.findFirst({
      where: {
        boardId,
        asanaTaskGid: requestedParentTaskGid
      },
      select: {
        asanaTaskGid: true,
        ancestryPath: true,
        nestingDepth: true
      }
    });

    if (!parentCard) {
      throw new Error("Selected parent task is not available on this board");
    }

    return {
      parentTaskGid: parentCard.asanaTaskGid,
      ancestryPath: [...parentCard.ancestryPath, parentCard.asanaTaskGid],
      nestingDepth: parentCard.nestingDepth + 1
    };
  }

  async function searchBoardTasks(_userId: string, query: string): Promise<TaskSearchResult> {
    const trimmedQuery = query.trim();
    const cards = await prisma.card.findMany({
      where: {
        ...(trimmedQuery
          ? {
              OR: [
                {
                  title: {
                    contains: trimmedQuery,
                    mode: "insensitive"
                  }
                },
                {
                  description: {
                    contains: trimmedQuery,
                    mode: "insensitive"
                  }
                },
                {
                  asanaTaskGid: {
                    contains: trimmedQuery
                  }
                },
                {
                  board: {
                    name: {
                      contains: trimmedQuery,
                      mode: "insensitive"
                    }
                  }
                }
              ]
            }
          : {})
      },
      include: {
        board: {
          select: {
            id: true,
            name: true,
            asanaParentTaskGid: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 12
    });

    const cardsByTaskGid = new Map(cards.map((card) => [card.asanaTaskGid, card]));

    return {
      items: cards.map((card) => toSearchableTaskSummary(card, cardsByTaskGid))
    };
  }

  return {
    listBoardsForUser,
    setStarredBoard,
    listWorkspaceUsers,
    createBoardForParentTask,
    createCardForBoard,
    moveCardWithinBoard,
    updateCardDueDate,
    updateCardAssignee,
    updateCardManualCompletion,
    syncBoard,
    searchBoardTasks
  };
}

function formatUserDisplayName(user: { email: string; displayName: string | null }) {
  return user.displayName?.trim() || user.email;
}

function normalizeAssigneeToken(value: string) {
  return value.trim().toLowerCase();
}

function resolveWorkspaceAssigneeFromAsana(
  asanaAssignee: { gid?: string; name?: string; email?: string } | null | undefined,
  workspaceUsers: WorkspaceUserRecord[]
) {
  if (!asanaAssignee) {
    return {
      assigneeAppUserId: null as string | null,
      assigneeName: null as string | null
    };
  }

  const asanaGid = asanaAssignee.gid ? String(asanaAssignee.gid) : null;
  const asanaEmail = asanaAssignee.email ? String(asanaAssignee.email) : null;
  const asanaName = asanaAssignee.name ? String(asanaAssignee.name) : null;

  if (asanaGid) {
    const byGid = workspaceUsers.find((user) => user.asanaUserGid === asanaGid);
    if (byGid) {
      return {
        assigneeAppUserId: byGid.id,
        assigneeName: formatUserDisplayName(byGid)
      };
    }
  }

  if (asanaEmail) {
    const normalizedEmail = normalizeAssigneeToken(asanaEmail);
    const byEmail = workspaceUsers.find((user) => normalizeAssigneeToken(user.email) === normalizedEmail);
    if (byEmail) {
      return {
        assigneeAppUserId: byEmail.id,
        assigneeName: formatUserDisplayName(byEmail)
      };
    }
  }

  if (asanaName) {
    const normalizedName = normalizeAssigneeToken(asanaName);
    const byName = workspaceUsers.find((user) => {
      const displayName = normalizeAssigneeToken(formatUserDisplayName(user));
      return displayName === normalizedName;
    });
    if (byName) {
      return {
        assigneeAppUserId: byName.id,
        assigneeName: formatUserDisplayName(byName)
      };
    }
  }

  return {
    assigneeAppUserId: null,
    assigneeName: asanaName ?? asanaEmail
  };
}

function toSearchableTaskSummary(card: any, cardsByTaskGid: Map<string, any>): TaskLinkableCardSummary {
  const parentTitle =
    card.asanaParentTaskGid === card.asanaRootTaskGid
      ? card.board?.name
      : cardsByTaskGid.get(card.asanaParentTaskGid)?.title;

  return {
    id: card.id,
    boardId: card.boardId ?? card.board?.id,
    boardName: card.board?.name ?? "Board",
    asanaTaskGid: card.asanaTaskGid,
    title: card.title,
    status: card.statusKey,
    nestingDepth: card.nestingDepth,
    parentTaskGid: card.asanaParentTaskGid,
    parentTitle: parentTitle ?? undefined
  };
}

function firstProjectName(projects: any) {
  if (Array.isArray(projects) && projects.length > 0 && projects[0]?.name) {
    return String(projects[0].name);
  }

  return undefined;
}

export function determineStatusKey(completed: boolean, dueOn?: string | null, manualStatusKey?: string | null) {
  if (completed) {
    return "done";
  }

  if (manualStatusKey === "backlog" || manualStatusKey === "review") {
    return manualStatusKey;
  }

  if (!dueOn) {
    return "not_started";
  }

  const dueDate = parseDateOnly(dueOn);
  const today = startOfToday();

  if (dueDate.getTime() < today.getTime()) {
    return "backlog";
  }

  return "active";
}

export function validateMoveTransition(input: MoveBoardCardInput, card?: BoardCard) {
  if (input.targetColumnKey === "not_started") {
    throw new Error("Cards cannot be moved into Not Started.");
  }

  if (input.targetColumnKey === "done") {
    if (!card || !canMarkCardComplete(card)) {
      throw new Error(CARD_COMPLETION_REQUIREMENT_MESSAGE);
    }
  }

  if (input.targetColumnKey === "active" && !input.dueOn) {
    throw new Error("A due date is required before moving a card into In Progress.");
  }
}

function computeEditableCardStatus(
  existingCard: { statusKey: string; manualStatusKey?: string | null },
  completed: boolean,
  dueOn?: string | null
) {
  return determineStatusKey(completed, dueOn, existingCard.manualStatusKey ?? null);
}

function extractTagNames(tags: any) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags.map((tag) => String(tag.name ?? "")).filter(Boolean);
}

function parseAsanaDate(value: string | undefined) {
  if (!value) {
    return new Date();
  }

  return new Date(value);
}

function parseAsanaDueValues(task: { due_on?: string | null; due_at?: string | null }) {
  return {
    dueOn: task.due_on ? String(task.due_on) : null,
    dueAt: task.due_at ? new Date(task.due_at) : null
  };
}

function parseDateOnly(value: string) {
  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    const fallback = new Date(value);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }

  return new Date(year, month - 1, day);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function mapBoard(board: any): BoardSummary {
  return {
    id: board.id,
    name: board.name,
    isStarred: Boolean(board.isStarred),
    asanaParentTaskGid: board.asanaParentTaskGid,
    workspaceName: board.asanaWorkspaceName,
    projectName: board.asanaProjectName,
    columns: [...board.boardColumnMappings]
      .sort((left: any, right: any) => columnOrder(left.columnKey) - columnOrder(right.columnKey))
      .map((column: any) => ({
        id: column.id,
        key: column.columnKey,
        name: column.columnName,
        color: column.columnColor,
        asanaEnumOptionGid: column.asanaEnumOptionGid ?? undefined
      })),
    cards: [...board.cards]
      .sort((left: any, right: any) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .map(mapCard)
  };
}

function mapCard(card: any): BoardCard {
  const normalizedLinks = (card.githubActivityLinks ?? []).map((entry: any) => ({
    id: entry.activity.id,
    type: entry.activity.activityType as "commit" | "pull_request",
    title: entry.activity.title,
    url: entry.activity.url,
    state: (entry.activity.state?.toLowerCase() as "open" | "merged" | "closed" | undefined) ?? undefined,
    sha: entry.activity.sha ?? undefined,
    pullRequestNumber: entry.activity.pullRequestNumber ?? undefined,
    branchName: entry.activity.branchName ?? undefined,
    authoredAt: entry.activity.authoredAt.toISOString(),
    authorName: entry.activity.authorName,
    authorLogin: entry.activity.authorLogin ?? undefined
  }));
  const legacyLinks = (card.developmentLinks ?? []).map((link: any) => ({
    id: link.id,
    type: link.linkType as "commit" | "branch" | "pull_request",
    title: link.title,
    url: link.url,
    state: (link.state?.toLowerCase() as "open" | "merged" | "closed" | undefined) ?? undefined,
    sha: link.sha ?? undefined,
    pullRequestNumber: undefined,
    branchName: undefined,
    authoredAt: link.authoredAt.toISOString(),
    authorName: link.authorName,
    authorLogin: undefined
  }));
  const mergedLinks = dedupeActivityLinks([...normalizedLinks, ...legacyLinks]).sort(
    (left, right) => Date.parse(right.authoredAt) - Date.parse(left.authoredAt)
  );
  if ((card.githubActivityLinks?.length ?? 0) > 0 && mergedLinks.length === 0 && process.env.NODE_ENV !== "test") {
    console.warn("[boards] Card lost visible GitHub activity links during hydration.", {
      cardId: card.id,
      githubActivityLinkCount: card.githubActivityLinks.length,
      developmentLinkCount: card.developmentLinks?.length ?? 0
    });
  }

  return {
    id: card.id,
    boardId: card.boardId,
    asanaTaskGid: card.asanaTaskGid,
    parentTaskGid: card.asanaParentTaskGid,
    rootTaskGid: card.asanaRootTaskGid,
    ancestryPath: card.ancestryPath,
    nestingDepth: card.nestingDepth,
    title: card.title,
    description: card.description,
    dueOn: card.dueOn ?? undefined,
    dueAt: card.dueAt ? card.dueAt.toISOString() : undefined,
    status: card.statusKey,
    assignee: card.assigneeName ?? undefined,
    assigneeAppUserId: card.assigneeAppUserId ?? undefined,
    assigneeNotInWorkspace: Boolean(card.assigneeName && !card.assigneeAppUserId),
    priority: (card.priority?.toLowerCase() as BoardCard["priority"] | undefined) ?? undefined,
    createdAt: (card.createdAt ?? card.updatedAt).toISOString(),
    updatedAt: card.updatedAt.toISOString(),
    tags: card.tags,
    manualCompletion: Boolean(card.manualCompletion),
    activityCounts: {
      commits: mergedLinks.filter((link) => link.type === "commit").length,
      pullRequests: mergedLinks.filter((link) => link.type === "pull_request").length,
      openPullRequests: mergedLinks.filter((link) => link.type === "pull_request" && link.state === "open").length,
      completedPullRequests: mergedLinks.filter((link) => link.type === "pull_request" && (link.state === "closed" || link.state === "merged")).length
    },
    links: mergedLinks
  };
}

function dedupeActivityLinks(links: BoardCard["links"]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.type}:${link.sha ?? ""}:${link.pullRequestNumber ?? ""}:${link.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function columnOrder(columnKey: string) {
  const index = DEFAULT_COLUMNS.findIndex((column) => column.key === columnKey);
  return index === -1 ? DEFAULT_COLUMNS.length : index;
}

async function resolveAuthorizedAsanaUser(client: AuthorizedAsanaClient) {
  const response = await client.users.getUser("me", {
    opt_fields: "gid,name"
  });

  if (!response.data?.gid) {
    throw new Error("The connected Asana user could not be resolved.");
  }

  return {
    gid: String(response.data.gid),
    name: response.data.name ? String(response.data.name) : undefined
  };
}

async function collectDescendantSubtasks(
  client: AuthorizedAsanaClient,
  rootTaskGid: string
) {
  const queue = [{ parentTaskGid: rootTaskGid, ancestryPath: [] as string[], nestingDepth: 0 }];
  const descendantsByTaskGid = new Map<string, {
    task: any;
    parentTaskGid: string;
    ancestryPath: string[];
    nestingDepth: number;
  }>();
  const expandedParentTaskGids = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (expandedParentTaskGids.has(current.parentTaskGid)) {
      continue;
    }

    expandedParentTaskGids.add(current.parentTaskGid);
    const subtasks = await listSubtasksForTask(client, current.parentTaskGid);

    for (const task of subtasks) {
      const taskGid = String(task.gid);
      descendantsByTaskGid.set(taskGid, {
        task,
        parentTaskGid: current.parentTaskGid,
        ancestryPath: current.ancestryPath,
        nestingDepth: current.nestingDepth
      });
      queue.push({
        parentTaskGid: taskGid,
        ancestryPath: [...current.ancestryPath, taskGid],
        nestingDepth: current.nestingDepth + 1
      });
    }
  }

  return Array.from(descendantsByTaskGid.values());
}

async function listSubtasksForTask(
  client: AuthorizedAsanaClient,
  taskGid: string
) {
  const subtasks: any[] = [];
  let offset: string | undefined;

  do {
    const response: any = await client.tasks.getSubtasksForTask(taskGid, {
      limit: 100,
      offset,
      opt_fields: SUBTASK_FIELDS
    });

    subtasks.push(...(response.data ?? []));
    offset = response.next_page?.offset ?? response.nextPage?.offset ?? undefined;
  } while (offset);

  return subtasks;
}
