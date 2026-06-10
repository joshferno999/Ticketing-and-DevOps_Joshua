import { describe, expect, it, vi } from "vitest";
import { repairGitHubActivityPersistence } from "./github-activity-repair";

describe("repairGitHubActivityPersistence", () => {
  it("normalizes a sha-backed row to commit identity", async () => {
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(prisma)),
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "activity_1",
            repositoryId: "repo_1",
            activityType: "pull_request",
            sha: "abc123",
            pullRequestNumber: null,
            title: "Fix bug",
            url: "https://example.com/commit/abc123",
            state: null,
            branchName: "main",
            authorName: "Hari",
            authorLogin: "hari",
            authoredAt: new Date("2026-05-20T10:00:00Z"),
            createdAt: new Date("2026-05-20T10:00:00Z"),
            taskLinks: []
          }
        ]),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn(),
        upsert: vi.fn()
      },
      gitHubActivityTaskLink: {
        createMany: vi.fn()
      }
    } as any;

    const stats = await repairGitHubActivityPersistence(prisma, {
      repositoryId: "repo_1"
    });

    expect(prisma.gitHubActivity.update).toHaveBeenCalledWith({
      where: { id: "activity_1" },
      data: { activityType: "commit" }
    });
    expect(stats.updated).toBe(1);
  });

  it("splits a mixed pull request row into canonical commit and pull request identities", async () => {
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(prisma)),
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "activity_pr_1",
            repositoryId: "repo_1",
            activityType: "pull_request",
            sha: "abc123",
            pullRequestNumber: 42,
            title: "Fix bug",
            url: "https://example.com/pull/42",
            state: "open",
            branchName: "feature/fix",
            authorName: "Hari",
            authorLogin: "hari",
            authoredAt: new Date("2026-05-20T10:00:00Z"),
            createdAt: new Date("2026-05-20T10:00:00Z"),
            taskLinks: [{ cardId: "card_1" }, { cardId: "card_2" }]
          }
        ]),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn(),
        upsert: vi.fn().mockResolvedValue({
          id: "activity_commit_1"
        })
      },
      gitHubActivityTaskLink: {
        createMany: vi.fn().mockResolvedValue({ count: 2 })
      }
    } as any;

    const stats = await repairGitHubActivityPersistence(prisma, {
      repositoryId: "repo_1",
      pullRequestNumber: 42
    });

    expect(prisma.gitHubActivity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repositoryId_sha: {
            repositoryId: "repo_1",
            sha: "abc123"
          }
        }
      })
    );
    expect(prisma.gitHubActivityTaskLink.createMany).toHaveBeenCalledWith({
      data: [
        { activityId: "activity_commit_1", cardId: "card_1" },
        { activityId: "activity_commit_1", cardId: "card_2" }
      ],
      skipDuplicates: true
    });
    expect(prisma.gitHubActivity.update).toHaveBeenCalledWith({
      where: { id: "activity_pr_1" },
      data: {
        sha: null,
        activityType: "pull_request"
      }
    });
    expect(stats.linkedTaskRowsCopied).toBe(2);
    expect(stats.updated).toBe(1);
  });

  it("deletes orphaned activity rows without identity or task links", async () => {
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(prisma)),
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "activity_orphan",
            repositoryId: "repo_1",
            activityType: "commit",
            sha: null,
            pullRequestNumber: null,
            title: "Unknown",
            url: "https://example.com",
            state: null,
            branchName: null,
            authorName: "Hari",
            authorLogin: "hari",
            authoredAt: new Date("2026-05-20T10:00:00Z"),
            createdAt: new Date("2026-05-20T10:00:00Z"),
            taskLinks: []
          }
        ]),
        update: vi.fn(),
        delete: vi.fn().mockResolvedValue({}),
        upsert: vi.fn()
      },
      gitHubActivityTaskLink: {
        createMany: vi.fn()
      }
    } as any;

    const stats = await repairGitHubActivityPersistence(prisma, {
      repositoryId: "repo_1"
    });

    expect(prisma.gitHubActivity.delete).toHaveBeenCalledWith({
      where: { id: "activity_orphan" }
    });
    expect(stats.deleted).toBe(1);
  });
});
