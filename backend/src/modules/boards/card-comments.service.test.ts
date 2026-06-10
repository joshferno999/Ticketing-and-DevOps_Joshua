import { describe, expect, it, vi } from "vitest";
import { encryptValue } from "../../lib/crypto";
import { ForbiddenError } from "../../lib/errors";
import { createCardCommentsService } from "./card-comments.service";

const env = {
  APP_AUTH_SECRET: "test-secret",
  ASANA_CLIENT_ID: "asana-client",
  ASANA_CLIENT_SECRET: "asana-secret",
  ASANA_REDIRECT_URI: "http://localhost:4000/api/integrations/asana/callback"
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

function asanaConnection(userId: string, asanaUserGid = `asana-${userId}`) {
  return {
    id: userId,
    email: `${userId}@example.com`,
    displayName: userId,
    asanaUserGid,
    asanaAccessTokenEncrypted: encryptValue(`token-${userId}`, env.APP_AUTH_SECRET),
    asanaRefreshTokenEncrypted: encryptValue(`refresh-${userId}`, env.APP_AUTH_SECRET),
    asanaTokenExpiresAt: new Date(Date.now() + 3_600_000)
  };
}

describe("card comments service", () => {
  it("lists only comment_added stories from Asana", async () => {
    const storiesClient = {
      getStoriesForTask: vi.fn().mockResolvedValue({
        data: [
          {
            gid: "story_1",
            resource_subtype: "comment_added",
            html_text: "<body>Hello</body>",
            text: "Hello",
            created_at: "2026-05-19T12:00:00.000Z",
            created_by: { gid: "asana-acting", name: "Acting User" }
          },
          {
            gid: "story_2",
            resource_subtype: "assigned"
          }
        ]
      })
    };

    const prisma = {
      board: {
        findUnique: vi.fn().mockResolvedValue({
          id: "board_1",
          importedByAppUserId: "importer_user"
        })
      },
      card: {
        findFirst: vi.fn().mockResolvedValue({
          id: "card_1",
          boardId: "board_1",
          asanaTaskGid: "task_1"
        })
      },
      appUser: {
        findMany: vi.fn().mockResolvedValue([asanaConnection("acting_user", "asana-acting")]),
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(asanaConnection(where.id, where.id === "acting_user" ? "asana-acting" : `asana-${where.id}`))
        )
      },
      cardComment: {
        upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve(create))
      }
    } as any;

    const asanaClientFactory = {
      fromAccessToken: vi.fn().mockReturnValue({
        stories: storiesClient,
        tasks: { addFollowersForTask: vi.fn() }
      })
    };

    const service = createCardCommentsService(prisma, asanaClientFactory as any, env);
    const result = await service.listCardComments("acting_user", "board_1", "card_1");

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.asanaStoryGid).toBe("story_1");
    expect(result.data[0]?.plainText).toBe("Hello");
  });

  it("creates a comment with mention followers and importer fallback", async () => {
    vi.useFakeTimers();
    const actingClient = {
      stories: {
        createStoryForTask: vi.fn().mockRejectedValue(writeAccessFailure())
      },
      tasks: {
        addFollowersForTask: vi.fn()
      }
    };
    const importerClient = {
      stories: {
        createStoryForTask: vi.fn().mockResolvedValue({
          data: {
            gid: "story_new",
            resource_subtype: "comment_added",
            html_text: "<body>Hi <a data-asana-gid=\"asana-mentioned\" data-asana-type=\"user\">@Mentioned</a></body>",
            text: "Hi @Mentioned",
            created_at: "2026-05-19T12:05:00.000Z",
            created_by: { gid: "asana-importer", name: "Importer" }
          }
        })
      },
      tasks: {
        addFollowersForTask: vi.fn().mockResolvedValue({ data: {} })
      }
    };

    const prisma = {
      board: {
        findUnique: vi.fn().mockResolvedValue({
          id: "board_1",
          importedByAppUserId: "importer_user"
        })
      },
      card: {
        findFirst: vi.fn().mockResolvedValue({
          id: "card_1",
          boardId: "board_1",
          asanaTaskGid: "task_1"
        })
      },
      appUser: {
        findMany: vi.fn().mockResolvedValue([
          asanaConnection("acting_user", "asana-acting"),
          asanaConnection("mentioned_user", "asana-mentioned")
        ]),
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === "mentioned_user") {
            return Promise.resolve(asanaConnection(where.id, "asana-mentioned"));
          }

          if (where.id === "importer_user") {
            return Promise.resolve(asanaConnection(where.id, "asana-importer"));
          }

          return Promise.resolve(asanaConnection(where.id));
        })
      },
      cardComment: {
        upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve(create))
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
    };

    const service = createCardCommentsService(prisma, asanaClientFactory as any, env);
    const createPromise = service.createCardComment("acting_user", "board_1", "card_1", {
      body: "Hi @Mentioned",
      mentions: [{ appUserId: "mentioned_user", start: 3, length: 10 }]
    });
    await vi.runAllTimersAsync();
    const result = await createPromise;

    expect(importerClient.tasks.addFollowersForTask).toHaveBeenCalledWith(
      { data: { followers: ["asana-mentioned"] } },
      "task_1"
    );
    expect(importerClient.stories.createStoryForTask).toHaveBeenCalled();
    expect(result.data.asanaStoryGid).toBe("story_new");
    vi.useRealTimers();
  });

  it("rejects mentions for users without Asana", async () => {
    const prisma = {
      board: {
        findUnique: vi.fn().mockResolvedValue({
          id: "board_1",
          importedByAppUserId: "importer_user"
        })
      },
      card: {
        findFirst: vi.fn().mockResolvedValue({
          id: "card_1",
          boardId: "board_1",
          asanaTaskGid: "task_1"
        })
      },
      appUser: {
        findMany: vi.fn().mockResolvedValue([
          asanaConnection("acting_user"),
          { ...asanaConnection("offline_user"), asanaUserGid: null }
        ])
      }
    } as any;

    const service = createCardCommentsService(prisma, { fromAccessToken: vi.fn() } as any, env);

    await expect(
      service.createCardComment("acting_user", "board_1", "card_1", {
        body: "Hi @Offline",
        mentions: [{ appUserId: "offline_user", start: 3, length: 8 }]
      })
    ).rejects.toThrow("User must connect Asana to be @mentioned.");
  });

  it("requires Asana connection to comment", async () => {
    const prisma = {
      board: {
        findUnique: vi.fn().mockResolvedValue({
          id: "board_1",
          importedByAppUserId: "importer_user"
        })
      },
      card: {
        findFirst: vi.fn().mockResolvedValue({
          id: "card_1",
          boardId: "board_1",
          asanaTaskGid: "task_1"
        })
      },
      appUser: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({
          id: "acting_user",
          asanaAccessTokenEncrypted: null
        })
      }
    } as any;

    const service = createCardCommentsService(prisma, { fromAccessToken: vi.fn() } as any, env);

    await expect(
      service.createCardComment("acting_user", "board_1", "card_1", {
        body: "Hello",
        mentions: []
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
