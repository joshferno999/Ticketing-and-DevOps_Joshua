import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../../lib/errors";
import { createBoardsService } from "./boards.service";

const env = {
  APP_AUTH_SECRET: "test-secret",
  ASANA_CLIENT_ID: "asana-client",
  ASANA_CLIENT_SECRET: "asana-secret",
  ASANA_REDIRECT_URI: "http://localhost:4000/api/integrations/asana/callback"
};

describe("boards access gates", () => {
  it("rejects card moves when Asana is not connected", async () => {
    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user_without_asana",
          asanaAccessTokenEncrypted: null,
          asanaRefreshTokenEncrypted: null,
          asanaTokenExpiresAt: null
        })
      },
      board: {
        findUnique: vi.fn()
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn()
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);

    await expect(
      service.moveCardWithinBoard("user_without_asana", "board_1", "card_1", {
        targetColumnKey: "backlog"
      })
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(prisma.board.findUnique).not.toHaveBeenCalled();
  });

  it("allows any signed-in user to update assignee without Asana connected", async () => {
    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user_assignee",
          email: "assignee@example.com",
          displayName: "Assignee User",
          asanaUserGid: null
        })
      },
      board: {
        findUnique: vi.fn().mockResolvedValue({
          id: "board_1",
          asanaParentTaskGid: "parent_1"
        })
      },
      card: {
        findFirst: vi.fn().mockResolvedValue({
          id: "card_1",
          boardId: "board_1",
          asanaTaskGid: "task_1"
        }),
        update: vi.fn().mockResolvedValue({
          id: "card_1",
          boardId: "board_1",
          asanaTaskGid: "task_1",
          asanaParentTaskGid: "parent_1",
          asanaRootTaskGid: "parent_1",
          ancestryPath: [],
          nestingDepth: 0,
          title: "Task",
          description: "",
          dueOn: null,
          dueAt: null,
          manualStatusKey: null,
          manualCompletion: false,
          statusKey: "backlog",
          assigneeName: "Assignee User",
          assigneeAppUserId: "user_assignee",
          priority: null,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          developmentLinks: [],
          githubActivityLinks: []
        })
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn()
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);
    const result = await service.updateCardAssignee("viewer_without_asana", "board_1", "card_1", "user_assignee");

    expect(result.data.assignee).toBe("Assignee User");
    expect(result.data.assigneeAppUserId).toBe("user_assignee");
    expect(result.data.assigneeNotInWorkspace).toBe(false);
  });

  it("hydrates multiple persisted commit links for a card without dropping earlier mappings", async () => {
    const linkedAt = new Date("2026-05-20T10:00:00Z");
    const prisma = {
      board: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ id: "board_1" }])
          .mockResolvedValueOnce([
            {
              id: "board_1",
              name: "Board One",
              asanaParentTaskGid: "parent_1",
              asanaWorkspaceName: "Workspace",
              asanaProjectName: "Project",
              updatedAt: linkedAt,
              boardColumnMappings: [],
              cards: [
                {
                  id: "card_1",
                  boardId: "board_1",
                  asanaTaskGid: "task_1",
                  asanaParentTaskGid: "parent_1",
                  asanaRootTaskGid: "parent_1",
                  ancestryPath: [],
                  nestingDepth: 0,
                  title: "Task",
                  description: "",
                  dueOn: null,
                  dueAt: null,
                  manualCompletion: false,
                  statusKey: "active",
                  assigneeName: null,
                  assigneeAppUserId: null,
                  priority: null,
                  tags: [],
                  createdAt: linkedAt,
                  updatedAt: linkedAt,
                  developmentLinks: [],
                  githubActivityLinks: [
                    {
                      activity: {
                        id: "activity_commit_1",
                        activityType: "commit",
                        title: "Commit one",
                        url: "https://example.com/commit/1",
                        state: null,
                        sha: "sha-1",
                        pullRequestNumber: null,
                        branchName: "main",
                        authorName: "Dev One",
                        authorLogin: "dev1",
                        authoredAt: linkedAt
                      }
                    },
                    {
                      activity: {
                        id: "activity_commit_2",
                        activityType: "commit",
                        title: "Commit two",
                        url: "https://example.com/commit/2",
                        state: null,
                        sha: "sha-2",
                        pullRequestNumber: null,
                        branchName: "main",
                        authorName: "Dev Two",
                        authorLogin: "dev2",
                        authoredAt: new Date("2026-05-20T11:00:00Z")
                      }
                    }
                  ]
                }
              ]
            }
          ])
      },
      boardColumnMapping: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn()
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);
    const result = await service.listBoardsForUser("viewer_user");
    const card = result.data[0]?.cards[0];

    expect(card?.activityCounts.commits).toBe(2);
    expect(card?.links.filter((link) => link.type === "commit").map((link) => link.sha)).toEqual(["sha-2", "sha-1"]);
  });

  it("sets a single starred board and returns it as the default board", async () => {
    const updatedAt = new Date("2026-05-20T10:00:00Z");
    const prisma = {
      board: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({
            id: "board_2",
            isStarred: false
          })
          .mockResolvedValueOnce({
            id: "board_2",
            isStarred: true
          })
          .mockResolvedValueOnce({
            id: "board_2",
            name: "Board Two",
            isStarred: true,
            asanaParentTaskGid: "parent_2",
            asanaWorkspaceName: "Workspace",
            asanaProjectName: "Project",
            boardColumnMappings: [],
            cards: [],
            updatedAt
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ id: "board_2", isStarred: true })
      },
      boardColumnMapping: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      $transaction: vi.fn(async (operations) => Promise.all(operations))
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn()
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);
    const result = await service.setStarredBoard("viewer_user", "board_2");

    expect(prisma.board.updateMany).toHaveBeenCalledWith({
      where: { isStarred: true },
      data: { isStarred: false }
    });
    expect(prisma.board.update).toHaveBeenCalledWith({
      where: { id: "board_2" },
      data: { isStarred: true }
    });
    expect(result.data.isStarred).toBe(true);
  });
});
