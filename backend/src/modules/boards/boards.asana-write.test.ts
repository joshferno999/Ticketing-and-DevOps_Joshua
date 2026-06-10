import { describe, expect, it, vi } from "vitest";
import { encryptValue } from "../../lib/crypto";
import { ForbiddenError } from "../../lib/errors";
import { createBoardsService } from "./boards.service";

const env = {
  APP_AUTH_SECRET: "test-secret",
  ASANA_CLIENT_ID: "asana-client",
  ASANA_CLIENT_SECRET: "asana-secret",
  ASANA_REDIRECT_URI: "http://localhost:4000/api/integrations/asana/callback"
};

const completableCard = {
  id: "card_1",
  boardId: "board_1",
  asanaTaskGid: "task_1",
  asanaParentTaskGid: "parent_1",
  asanaRootTaskGid: "parent_1",
  ancestryPath: [],
  nestingDepth: 0,
  title: "Ship feature",
  description: "",
  dueOn: null,
  dueAt: null,
  manualStatusKey: null,
  manualCompletion: false,
  statusKey: "review",
  assigneeName: null,
  assigneeAppUserId: null,
  priority: null,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  developmentLinks: [],
  githubActivityLinks: [
    {
      activity: {
        activityType: "commit",
        title: "Fix bug",
        url: "https://example.com/commit",
        state: null,
        sha: "abc",
        pullRequestNumber: null,
        branchName: "main",
        authorName: "Dev",
        authorLogin: "dev",
        authoredAt: new Date()
      }
    }
  ]
};

function writeAccessFailure() {
  return Object.assign(new Error("Forbidden"), {
    status: 403,
    response: {
      text: JSON.stringify({
        errors: [{ error: "write_access_failure", message: "You do not have permission to perform that action." }]
      })
    }
  });
}

function asanaConnection(userId: string) {
  return {
    id: userId,
    asanaAccessTokenEncrypted: encryptValue(`token-${userId}`, env.APP_AUTH_SECRET),
    asanaRefreshTokenEncrypted: encryptValue(`refresh-${userId}`, env.APP_AUTH_SECRET),
    asanaTokenExpiresAt: new Date(Date.now() + 3_600_000)
  };
}

describe("boards Asana write fallback", () => {
  it("retries task updates with the board importer token after write_access_failure", async () => {
    const actingClient = {
      tasks: {
        updateTask: vi.fn().mockRejectedValue(writeAccessFailure())
      }
    };
    const importerClient = {
      tasks: {
        updateTask: vi.fn().mockResolvedValue({
          data: {
            gid: "task_1",
            name: "Ship feature",
            notes: "",
            completed: true,
            modified_at: new Date().toISOString(),
            tags: []
          }
        })
      }
    };

    const prisma = {
      appUser: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(asanaConnection(where.id))
        ),
        findMany: vi.fn().mockResolvedValue([])
      },
      board: {
        findUnique: vi.fn().mockResolvedValue({
          id: "board_1",
          importedByAppUserId: "importer_user"
        })
      },
      card: {
        findFirst: vi.fn().mockResolvedValue(completableCard),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...completableCard,
            ...data,
            statusKey: data.statusKey
          })
        )
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn((token: string) => {
        if (token === "token-acting_user") {
          return actingClient;
        }
        if (token === "token-importer_user") {
          return importerClient;
        }
        throw new Error(`Unexpected token: ${token}`);
      })
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);

    const result = await service.moveCardWithinBoard("acting_user", "board_1", "card_1", {
      targetColumnKey: "done"
    });

    expect(actingClient.tasks.updateTask).toHaveBeenCalledTimes(1);
    expect(importerClient.tasks.updateTask).toHaveBeenCalledTimes(1);
    expect(result.data.status).toBe("done");
  });

  it("returns a friendly forbidden error when neither user can edit the task", async () => {
    const failingClient = {
      tasks: {
        updateTask: vi.fn().mockRejectedValue(writeAccessFailure())
      }
    };

    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue(asanaConnection("acting_user")),
        findMany: vi.fn().mockResolvedValue([])
      },
      board: {
        findUnique: vi.fn().mockResolvedValue({
          id: "board_1",
          importedByAppUserId: "acting_user"
        })
      },
      card: {
        findFirst: vi.fn().mockResolvedValue(completableCard)
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn().mockReturnValue(failingClient)
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);

    await expect(
      service.moveCardWithinBoard("acting_user", "board_1", "card_1", {
        targetColumnKey: "done"
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("persists a sticky manual review override when moving a card into In PR", async () => {
    const actingClient = {
      tasks: {
        updateTask: vi.fn().mockResolvedValue({
          data: {
            gid: "task_1",
            name: "Ship feature",
            notes: "",
            completed: false,
            due_on: "2000-01-01",
            modified_at: new Date().toISOString(),
            tags: []
          }
        })
      }
    };

    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue(asanaConnection("acting_user")),
        findMany: vi.fn().mockResolvedValue([])
      },
      board: {
        findUnique: vi.fn().mockResolvedValue({
          id: "board_1",
          importedByAppUserId: "acting_user"
        })
      },
      card: {
        findFirst: vi.fn().mockResolvedValue(completableCard),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...completableCard,
            ...data,
            statusKey: data.statusKey,
            manualStatusKey: data.manualStatusKey
          })
        )
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn().mockReturnValue(actingClient)
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);

    const result = await service.moveCardWithinBoard("acting_user", "board_1", "card_1", {
      targetColumnKey: "review"
    });

    expect(actingClient.tasks.updateTask).toHaveBeenCalledTimes(1);
    expect(prisma.card.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statusKey: "review",
          manualStatusKey: "review"
        })
      })
    );
    expect(result.data.status).toBe("review");
  });

  it("clears the manual review override when moving a card from In PR to In Progress", async () => {
    const actingClient = {
      tasks: {
        updateTask: vi.fn().mockResolvedValue({
          data: {
            gid: "task_1",
            name: "Ship feature",
            notes: "",
            completed: false,
            due_on: "2099-01-01",
            assignee: {
              gid: "asana-user-1",
              name: "Acting User"
            },
            modified_at: new Date().toISOString(),
            tags: []
          }
        })
      },
      users: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            gid: "asana-user-1",
            name: "Acting User"
          }
        })
      }
    };

    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue(asanaConnection("acting_user")),
        findMany: vi.fn().mockResolvedValue([])
      },
      board: {
        findUnique: vi.fn().mockResolvedValue({
          id: "board_1",
          importedByAppUserId: "acting_user"
        })
      },
      card: {
        findFirst: vi.fn().mockResolvedValue({
          ...completableCard,
          manualStatusKey: "review"
        }),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...completableCard,
            ...data,
            statusKey: data.statusKey,
            manualStatusKey: data.manualStatusKey
          })
        )
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn().mockReturnValue(actingClient)
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);

    const result = await service.moveCardWithinBoard("acting_user", "board_1", "card_1", {
      targetColumnKey: "active",
      dueOn: "2099-01-01"
    });

    expect(prisma.card.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statusKey: "active",
          manualStatusKey: null,
          dueOn: "2099-01-01"
        })
      })
    );
    expect(result.data.status).toBe("active");
  });

  it("keeps a manually moved In PR card in review during sync when the Asana task is overdue", async () => {
    const syncedCard = {
      id: "card_1",
      boardId: "board_1",
      asanaTaskGid: "task_1",
      asanaParentTaskGid: "parent_1",
      asanaRootTaskGid: "parent_1",
      ancestryPath: [],
      nestingDepth: 0,
      title: "Ship feature",
      description: "",
      dueOn: "2000-01-01",
      dueAt: null,
      manualStatusKey: "review",
      manualCompletion: false,
      statusKey: "review",
      assigneeName: null,
      assigneeAppUserId: null,
      priority: null,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      developmentLinks: [],
      githubActivityLinks: []
    };

    const actingClient = {
      tasks: {
        getSubtasksForTask: vi.fn().mockImplementation((taskGid: string) => {
          if (taskGid === "parent_1") {
            return Promise.resolve({
              data: [
                {
                  gid: "task_1",
                  name: "Ship feature",
                  notes: "",
                  completed: false,
                  due_on: "2000-01-01",
                  modified_at: new Date().toISOString(),
                  tags: [],
                  assignee: null
                }
              ]
            });
          }

          return Promise.resolve({ data: [] });
        })
      }
    };

    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue(asanaConnection("acting_user")),
        findMany: vi.fn().mockResolvedValue([])
      },
      board: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: "board_1",
            importedByAppUserId: "acting_user",
            asanaParentTaskGid: "parent_1"
          })
          .mockResolvedValueOnce({ id: "board_1" })
          .mockResolvedValueOnce({
            id: "board_1",
            name: "Board",
            asanaParentTaskGid: "parent_1",
            asanaWorkspaceName: "Workspace",
            asanaProjectName: "Project",
            boardColumnMappings: [],
            cards: [syncedCard]
          }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "board_1",
          cards: [syncedCard]
        })
      },
      boardColumnMapping: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      card: {
        upsert: vi.fn().mockResolvedValue(syncedCard),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn().mockReturnValue(actingClient)
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);

    const result = await service.syncBoard("acting_user", "board_1");

    expect(prisma.card.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          manualStatusKey: "review",
          statusKey: "review"
        })
      })
    );
    expect(result.data.cards[0]?.status).toBe("review");
  });

  it("keeps a manually moved In PR card in review during sync when the Asana task has no due date", async () => {
    const syncedCard = {
      id: "card_1",
      boardId: "board_1",
      asanaTaskGid: "task_1",
      asanaParentTaskGid: "parent_1",
      asanaRootTaskGid: "parent_1",
      ancestryPath: [],
      nestingDepth: 0,
      title: "Ship feature",
      description: "",
      dueOn: null,
      dueAt: null,
      manualStatusKey: "review",
      manualCompletion: false,
      statusKey: "review",
      assigneeName: null,
      assigneeAppUserId: null,
      priority: null,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      developmentLinks: [],
      githubActivityLinks: []
    };

    const actingClient = {
      tasks: {
        getSubtasksForTask: vi.fn().mockImplementation((taskGid: string) => {
          if (taskGid === "parent_1") {
            return Promise.resolve({
              data: [
                {
                  gid: "task_1",
                  name: "Ship feature",
                  notes: "",
                  completed: false,
                  due_on: null,
                  modified_at: new Date().toISOString(),
                  tags: [],
                  assignee: null
                }
              ]
            });
          }

          return Promise.resolve({ data: [] });
        })
      }
    };

    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue(asanaConnection("acting_user")),
        findMany: vi.fn().mockResolvedValue([])
      },
      board: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: "board_1",
            importedByAppUserId: "acting_user",
            asanaParentTaskGid: "parent_1"
          })
          .mockResolvedValueOnce({ id: "board_1" })
          .mockResolvedValueOnce({
            id: "board_1",
            name: "Board",
            asanaParentTaskGid: "parent_1",
            asanaWorkspaceName: "Workspace",
            asanaProjectName: "Project",
            boardColumnMappings: [],
            cards: [syncedCard]
          }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "board_1",
          cards: [syncedCard]
        })
      },
      boardColumnMapping: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      card: {
        upsert: vi.fn().mockResolvedValue(syncedCard),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn().mockReturnValue(actingClient)
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);

    const result = await service.syncBoard("acting_user", "board_1");

    expect(prisma.card.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          manualStatusKey: "review",
          statusKey: "review"
        })
      })
    );
    expect(result.data.cards[0]?.status).toBe("review");
  });

  it("moves a manually reviewed card to done during sync when Asana marks it completed", async () => {
    const syncedCard = {
      id: "card_1",
      boardId: "board_1",
      asanaTaskGid: "task_1",
      asanaParentTaskGid: "parent_1",
      asanaRootTaskGid: "parent_1",
      ancestryPath: [],
      nestingDepth: 0,
      title: "Ship feature",
      description: "",
      dueOn: "2099-01-01",
      dueAt: null,
      manualStatusKey: "review",
      manualCompletion: false,
      statusKey: "done",
      assigneeName: null,
      assigneeAppUserId: null,
      priority: null,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      developmentLinks: [],
      githubActivityLinks: []
    };

    const actingClient = {
      tasks: {
        getSubtasksForTask: vi.fn().mockImplementation((taskGid: string) => {
          if (taskGid === "parent_1") {
            return Promise.resolve({
              data: [
                {
                  gid: "task_1",
                  name: "Ship feature",
                  notes: "",
                  completed: true,
                  due_on: "2099-01-01",
                  modified_at: new Date().toISOString(),
                  tags: [],
                  assignee: null
                }
              ]
            });
          }

          return Promise.resolve({ data: [] });
        })
      }
    };

    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue(asanaConnection("acting_user")),
        findMany: vi.fn().mockResolvedValue([])
      },
      board: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: "board_1",
            importedByAppUserId: "acting_user",
            asanaParentTaskGid: "parent_1"
          })
          .mockResolvedValueOnce({ id: "board_1" })
          .mockResolvedValueOnce({
            id: "board_1",
            name: "Board",
            asanaParentTaskGid: "parent_1",
            asanaWorkspaceName: "Workspace",
            asanaProjectName: "Project",
            boardColumnMappings: [],
            cards: [syncedCard]
          }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "board_1",
          cards: [
            {
              ...syncedCard,
              statusKey: "review"
            }
          ]
        })
      },
      boardColumnMapping: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      card: {
        upsert: vi.fn().mockResolvedValue(syncedCard),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn().mockReturnValue(actingClient)
    } as any;

    const service = createBoardsService(prisma, asanaClientFactory, env);

    const result = await service.syncBoard("acting_user", "board_1");

    expect(prisma.card.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          manualStatusKey: "review",
          statusKey: "done"
        })
      })
    );
    expect(result.data.cards[0]?.status).toBe("done");
  });
});
