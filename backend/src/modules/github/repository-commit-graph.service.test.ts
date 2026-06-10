import { describe, expect, it, vi } from "vitest";
import type { RepositoryCommitNode } from "@emergence-devops/shared";
import { ForbiddenError, NotFoundError } from "../../lib/errors";
import { createRepositoryCommitGraphService, topologicallySortRepositoryCommits } from "./repository-commit-graph.service";

function makeCommit(input: Partial<RepositoryCommitNode> & Pick<RepositoryCommitNode, "sha" | "committedAt">): RepositoryCommitNode {
  return {
    shortSha: input.sha.slice(0, 7),
    messageHeadline: "commit",
    messageBody: "",
    authorName: "Author",
    authoredAt: input.committedAt,
    parentShas: [],
    branchHeadNames: [],
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    htmlUrl: "https://github.com/example/repo/commit/" + input.sha,
    taggedTaskCount: 0,
    taggedTasksPreview: [],
    ...input
  };
}

describe("topologicallySortRepositoryCommits", () => {
  it("keeps children before parents across merges", () => {
    const commits = [
      makeCommit({ sha: "a1", committedAt: "2026-05-18T10:00:00Z", parentShas: ["b1", "c1"] }),
      makeCommit({ sha: "b1", committedAt: "2026-05-18T09:00:00Z", parentShas: ["d1"] }),
      makeCommit({ sha: "c1", committedAt: "2026-05-18T09:30:00Z", parentShas: ["d1"] }),
      makeCommit({ sha: "d1", committedAt: "2026-05-18T08:00:00Z", parentShas: [] })
    ];

    const ordered = topologicallySortRepositoryCommits(commits);
    const positions = new Map(ordered.map((commit, index) => [commit.sha, index]));

    expect(ordered.map((commit) => commit.sha)[0]).toBe("a1");
    expect(positions.get("a1")!).toBeLessThan(positions.get("b1")!);
    expect(positions.get("a1")!).toBeLessThan(positions.get("c1")!);
    expect(positions.get("b1")!).toBeLessThan(positions.get("d1")!);
    expect(positions.get("c1")!).toBeLessThan(positions.get("d1")!);
  });
});

describe("createRepositoryCommitGraphService", () => {
  it("throws when GitHub is not connected for the user", async () => {
    const prisma = {
      gitHubInstallation: {
        count: vi.fn().mockResolvedValue(0)
      },
      gitHubRepository: {
        findFirst: vi.fn()
      }
    } as any;

    const githubService = {
      getInstallationOctokit: vi.fn()
    } as any;

    const service = createRepositoryCommitGraphService(prisma, githubService);
    await expect(service.getRepositoryCommitGraph("user_1", "repo_1", "all")).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.gitHubRepository.findFirst).not.toHaveBeenCalled();
    expect(githubService.getInstallationOctokit).not.toHaveBeenCalled();
  });

  it("throws when the repository is outside the user's granted installations", async () => {
    const prisma = {
      gitHubInstallation: {
        count: vi.fn().mockResolvedValue(1)
      },
      gitHubRepository: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([])
      }
    } as any;

    const githubService = {
      getInstallationOctokit: vi.fn()
    } as any;

    const service = createRepositoryCommitGraphService(prisma, githubService);
    await expect(service.getRepositoryCommitGraph("user_1", "repo_1", "all")).rejects.toBeInstanceOf(NotFoundError);
    expect(githubService.getInstallationOctokit).not.toHaveBeenCalled();
  });

  it("deduplicates commits across branches and preserves PR metadata", async () => {
    const prisma = {
      gitHubInstallation: {
        count: vi.fn().mockResolvedValue(1)
      },
      gitHubRepository: {
        findFirst: vi.fn().mockResolvedValue({
          id: "repo_db_1",
          fullName: "Emergence-Mobility/Emergence_Webapp_Backend",
          githubInstallation: {
            githubInstallationId: BigInt(123)
          }
        })
      },
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([])
      }
    } as any;

    const octokit = {
      request: vi.fn(async (route: string, params?: { ref?: string }) => {
        if (route === "GET /repos/{owner}/{repo}") {
          return {
            data: {
              name: "Emergence_Webapp_Backend",
              full_name: "Emergence-Mobility/Emergence_Webapp_Backend",
              default_branch: "main",
              html_url: "https://github.com/Emergence-Mobility/Emergence_Webapp_Backend"
            }
          };
        }

        if (route === "GET /repos/{owner}/{repo}/commits/{ref}") {
          const committedAt = params?.ref === "feature" ? "2026-05-18T11:00:00Z" : "2026-05-18T10:00:00Z";
          return {
            data: {
              commit: {
                committer: {
                  date: committedAt
                }
              }
            }
          };
        }

        if (route === "GET /repos/{owner}/{repo}/branches") {
          return {
            data: [
              { name: "main", commit: { sha: "aaa1111" } },
              { name: "feature", commit: { sha: "bbb2222" } }
            ]
          };
        }

        throw new Error(`Unexpected route: ${route}`);
      }),
      rest: {
        repos: {
          listBranches: vi.fn()
        }
      },
      graphql: vi.fn(async (_query: string, variables: { qualifiedName: string }) => {
        if (variables.qualifiedName === "refs/heads/main") {
          return {
            repository: {
              ref: {
                target: {
                  history: {
                    nodes: [
                      {
                        oid: "aaa1111",
                        abbreviatedOid: "aaa1111",
                        messageHeadline: "main head",
                        messageBody: "",
                        committedDate: "2026-05-18T10:00:00Z",
                        authoredDate: "2026-05-18T10:00:00Z",
                        additions: 3,
                        deletions: 1,
                        changedFilesIfAvailable: 2,
                        url: "https://github.com/commit/aaa1111",
                        parents: { nodes: [{ oid: "ccc3333" }] },
                        author: { name: "Hari", user: { login: "hari", avatarUrl: "https://example.com/a.png" } },
                        associatedPullRequests: { nodes: [] }
                      }
                    ]
                  }
                }
              }
            }
          };
        }

        return {
          repository: {
            ref: {
              target: {
                history: {
                  nodes: [
                    {
                      oid: "bbb2222",
                      abbreviatedOid: "bbb2222",
                      messageHeadline: "feature head",
                      messageBody: "body",
                      committedDate: "2026-05-18T11:00:00Z",
                      authoredDate: "2026-05-18T11:00:00Z",
                      additions: 10,
                      deletions: 4,
                      changedFilesIfAvailable: 3,
                      url: "https://github.com/commit/bbb2222",
                      parents: { nodes: [{ oid: "aaa1111" }] },
                      author: { name: "Hari", user: { login: "hari", avatarUrl: "https://example.com/a.png" } },
                      associatedPullRequests: {
                        nodes: [
                          {
                            id: "pr_1",
                            number: 42,
                            title: "Feature PR",
                            state: "CLOSED",
                            merged: true,
                            url: "https://github.com/pr/42"
                          }
                        ]
                      }
                    },
                    {
                      oid: "aaa1111",
                      abbreviatedOid: "aaa1111",
                      messageHeadline: "main head",
                      messageBody: "",
                      committedDate: "2026-05-18T10:00:00Z",
                      authoredDate: "2026-05-18T10:00:00Z",
                      additions: 3,
                      deletions: 1,
                      changedFilesIfAvailable: 2,
                      url: "https://github.com/commit/aaa1111",
                      parents: { nodes: [{ oid: "ccc3333" }] },
                      author: { name: "Hari", user: { login: "hari", avatarUrl: "https://example.com/a.png" } },
                      associatedPullRequests: { nodes: [] }
                    }
                  ]
                }
              }
            }
          }
        };
      })
    };

    const githubService = {
      getInstallationOctokit: vi.fn().mockResolvedValue(octokit)
    } as any;

    const service = createRepositoryCommitGraphService(prisma, githubService);
    const payload = await service.getRepositoryCommitGraph("user_1", "repo_db_1", "all");

    expect(payload).not.toBeNull();
    expect(payload!.commits).toHaveLength(2);
    expect(payload!.commits[0]!.sha).toBe("bbb2222");
    expect(payload!.commits[0]!.pullRequest?.state).toBe("MERGED");
    expect(payload!.commits.find((commit) => commit.sha === "aaa1111")?.branchHeadNames).toEqual(["main"]);
    expect(payload!.commits.find((commit) => commit.sha === "bbb2222")?.branchHeadNames).toEqual(["feature"]);
    expect(payload!.pageInfo.hasMore).toBe(false);
    expect(payload!.pageInfo.totalCommits).toBe(2);
  });

  it("returns paginated commit slices with nextOffset metadata", async () => {
    const prisma = {
      gitHubInstallation: {
        count: vi.fn().mockResolvedValue(1)
      },
      gitHubRepository: {
        findFirst: vi.fn().mockResolvedValue({
          id: "repo_db_1",
          fullName: "Emergence-Mobility/Emergence_Webapp_Backend",
          githubInstallation: {
            githubInstallationId: BigInt(123)
          }
        })
      },
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([])
      }
    } as any;

    const octokit = {
      request: vi.fn(async (route: string) => {
        if (route === "GET /repos/{owner}/{repo}") {
          return {
            data: {
              name: "Emergence_Webapp_Backend",
              full_name: "Emergence-Mobility/Emergence_Webapp_Backend",
              default_branch: "main",
              html_url: "https://github.com/Emergence-Mobility/Emergence_Webapp_Backend"
            }
          };
        }

        if (route === "GET /repos/{owner}/{repo}/commits/{ref}") {
          return {
            data: {
              commit: {
                committer: {
                  date: "2026-05-18T10:00:00Z"
                }
              }
            }
          };
        }

        if (route === "GET /repos/{owner}/{repo}/branches") {
          return {
            data: [{ name: "main", commit: { sha: "sha-1" } }]
          };
        }

        throw new Error(`Unexpected route: ${route}`);
      }),
      graphql: vi.fn(async () => ({
        repository: {
          ref: {
            target: {
              history: {
                nodes: [
                  {
                    oid: "sha-1",
                    abbreviatedOid: "sha-1",
                    messageHeadline: "commit-1",
                    messageBody: "",
                    committedDate: "2026-05-18T12:00:00Z",
                    authoredDate: "2026-05-18T12:00:00Z",
                    additions: 1,
                    deletions: 0,
                    changedFilesIfAvailable: 1,
                    url: "https://github.com/commit/sha-1",
                    parents: { nodes: [{ oid: "sha-2" }] },
                    author: { name: "Hari", user: { login: "hari", avatarUrl: "https://example.com/a.png" } },
                    associatedPullRequests: { nodes: [] }
                  },
                  {
                    oid: "sha-2",
                    abbreviatedOid: "sha-2",
                    messageHeadline: "commit-2",
                    messageBody: "",
                    committedDate: "2026-05-18T11:00:00Z",
                    authoredDate: "2026-05-18T11:00:00Z",
                    additions: 1,
                    deletions: 0,
                    changedFilesIfAvailable: 1,
                    url: "https://github.com/commit/sha-2",
                    parents: { nodes: [{ oid: "sha-3" }] },
                    author: { name: "Hari", user: { login: "hari", avatarUrl: "https://example.com/a.png" } },
                    associatedPullRequests: { nodes: [] }
                  },
                  {
                    oid: "sha-3",
                    abbreviatedOid: "sha-3",
                    messageHeadline: "commit-3",
                    messageBody: "",
                    committedDate: "2026-05-18T10:00:00Z",
                    authoredDate: "2026-05-18T10:00:00Z",
                    additions: 1,
                    deletions: 0,
                    changedFilesIfAvailable: 1,
                    url: "https://github.com/commit/sha-3",
                    parents: { nodes: [] },
                    author: { name: "Hari", user: { login: "hari", avatarUrl: "https://example.com/a.png" } },
                    associatedPullRequests: { nodes: [] }
                  }
                ]
              }
            }
          }
        }
      }))
    };

    const githubService = {
      getInstallationOctokit: vi.fn().mockResolvedValue(octokit)
    } as any;

    const service = createRepositoryCommitGraphService(prisma, githubService);
    const payload = await service.getRepositoryCommitGraph("user_1", "repo_db_1", "all", undefined, 1, 1);

    expect(payload).not.toBeNull();
    expect(payload!.commits).toHaveLength(1);
    expect(payload!.commits[0]!.sha).toBe("sha-2");
    expect(payload!.pageInfo.offset).toBe(1);
    expect(payload!.pageInfo.limit).toBe(1);
    expect(payload!.pageInfo.nextOffset).toBe(2);
    expect(payload!.pageInfo.hasMore).toBe(true);
    expect(payload!.pageInfo.totalCommits).toBe(3);
  });

  it("fetches additional GitHub history pages when the requested window exceeds the first page", async () => {
    const prisma = {
      gitHubInstallation: {
        count: vi.fn().mockResolvedValue(1)
      },
      gitHubRepository: {
        findFirst: vi.fn().mockResolvedValue({
          id: "repo_db_1",
          fullName: "Emergence-Mobility/Emergence_Webapp_Backend",
          githubInstallation: {
            githubInstallationId: BigInt(123)
          }
        })
      },
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([])
      }
    } as any;

    const octokit = {
      request: vi.fn(async (route: string) => {
        if (route === "GET /repos/{owner}/{repo}") {
          return {
            data: {
              name: "Emergence_Webapp_Backend",
              full_name: "Emergence-Mobility/Emergence_Webapp_Backend",
              default_branch: "main",
              html_url: "https://github.com/Emergence-Mobility/Emergence_Webapp_Backend"
            }
          };
        }

        if (route === "GET /repos/{owner}/{repo}/commits/{ref}") {
          return {
            data: {
              commit: {
                committer: {
                  date: "2026-05-18T12:00:00Z"
                }
              }
            }
          };
        }

        if (route === "GET /repos/{owner}/{repo}/branches") {
          return {
            data: [{ name: "main", commit: { sha: "sha-1" } }]
          };
        }

        throw new Error(`Unexpected route: ${route}`);
      }),
      graphql: vi
        .fn()
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                history: {
                  pageInfo: {
                    hasNextPage: true,
                    endCursor: "cursor-1"
                  },
                  nodes: Array.from({ length: 50 }, (_, index) => ({
                    oid: `sha-${String(index + 1).padStart(3, "0")}`,
                    abbreviatedOid: `sha-${String(index + 1).padStart(3, "0")}`.slice(0, 7),
                    messageHeadline: `commit-${index + 1}`,
                    messageBody: "",
                    committedDate: new Date(Date.UTC(2026, 4, 18, 12, 0 - index)).toISOString(),
                    authoredDate: new Date(Date.UTC(2026, 4, 18, 12, 0 - index)).toISOString(),
                    additions: 1,
                    deletions: 0,
                    changedFilesIfAvailable: 1,
                    url: `https://github.com/commit/${index + 1}`,
                    parents: {
                      nodes: index < 49 ? [{ oid: `sha-${String(index + 2).padStart(3, "0")}` }] : []
                    },
                    author: { name: "Hari", user: { login: "hari", avatarUrl: "https://example.com/a.png" } },
                    associatedPullRequests: { nodes: [] }
                  }))
                }
              }
            }
          }
        })
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                history: {
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null
                  },
                  nodes: [
                    {
                      oid: "sha-051",
                      abbreviatedOid: "sha-051",
                      messageHeadline: "commit-51",
                      messageBody: "",
                      committedDate: "2026-05-18T11:09:00.000Z",
                      authoredDate: "2026-05-18T11:09:00.000Z",
                      additions: 1,
                      deletions: 0,
                      changedFilesIfAvailable: 1,
                      url: "https://github.com/commit/51",
                      parents: { nodes: [] },
                      author: { name: "Hari", user: { login: "hari", avatarUrl: "https://example.com/a.png" } },
                      associatedPullRequests: { nodes: [] }
                    }
                  ]
                }
              }
            }
          }
        })
    };

    const githubService = {
      getInstallationOctokit: vi.fn().mockResolvedValue(octokit)
    } as any;

    const service = createRepositoryCommitGraphService(prisma, githubService);
    const payload = await service.getRepositoryCommitGraph("user_1", "repo_db_1", "all", undefined, 50, 10);

    expect(payload).not.toBeNull();
    expect(octokit.graphql).toHaveBeenCalledTimes(2);
    expect(payload!.commits[0]!.sha).toBe("sha-051");
    expect(payload!.pageInfo.hasMore).toBe(false);
    expect(payload!.pageInfo.totalCommits).toBe(51);
  });

  it("persists multiple task links for a commit and returns normalized linked tasks", async () => {
    const linkedCards = [
      {
        id: "card_1",
        boardId: "board_1",
        asanaTaskGid: "1200000001",
        asanaParentTaskGid: "1200000000",
        asanaRootTaskGid: "1200000000",
        nestingDepth: 0,
        title: "Task one",
        statusKey: "active",
        board: { id: "board_1", name: "Board One" }
      },
      {
        id: "card_2",
        boardId: "board_1",
        asanaTaskGid: "1200000002",
        asanaParentTaskGid: "1200000000",
        asanaRootTaskGid: "1200000000",
        nestingDepth: 1,
        title: "Task two",
        statusKey: "review",
        board: { id: "board_1", name: "Board One" }
      }
    ];

    const prisma = {
      gitHubInstallation: {
        count: vi.fn().mockResolvedValue(1)
      },
      gitHubRepository: {
        findFirst: vi.fn().mockResolvedValue({
          id: "repo_db_1",
          fullName: "Emergence-Mobility/Emergence_Webapp_Backend",
          githubInstallation: {
            githubInstallationId: BigInt(123)
          }
        })
      },
      card: {
        findMany: vi.fn().mockResolvedValue(linkedCards)
      },
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: "activity_1",
            activityType: "commit",
            title: "feat: tagged commit",
            url: "https://github.com/example/repo/commit/abc123",
            state: null,
            sha: "abc123",
            pullRequestNumber: null,
            branchName: null,
            authoredAt: new Date("2026-05-18T10:00:00Z"),
            authorName: "Hari",
            authorLogin: "hari",
            taskLinks: linkedCards.map((card) => ({ card }))
          })
          .mockResolvedValueOnce({
            id: "activity_1",
            activityType: "commit",
            title: "feat: tagged commit",
            url: "https://github.com/example/repo/commit/abc123",
            state: null,
            sha: "abc123",
            pullRequestNumber: null,
            branchName: null,
            authoredAt: new Date("2026-05-18T10:00:00Z"),
            authorName: "Hari",
            authorLogin: "hari",
            taskLinks: linkedCards.map((card) => ({ card }))
          }),
        upsert: vi.fn().mockResolvedValue({ id: "activity_1" })
      },
      gitHubActivityTaskLink: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 })
      }
    } as any;

    const octokit = {
      request: vi.fn(async (route: string) => {
        if (route === "GET /repos/{owner}/{repo}/commits/{ref}") {
          return {
            data: {
              html_url: "https://github.com/example/repo/commit/abc123",
              author: { login: "hari" },
              commit: {
                message: "feat: tagged commit\n\nbody",
                author: {
                  name: "Hari",
                  date: "2026-05-18T10:00:00Z"
                },
                committer: {
                  date: "2026-05-18T10:00:00Z"
                }
              }
            }
          };
        }

        throw new Error(`Unexpected route: ${route}`);
      })
    };

    const githubService = {
      getInstallationOctokit: vi.fn().mockResolvedValue(octokit)
    } as any;

    const service = createRepositoryCommitGraphService(prisma, githubService);
    const payload = await service.replaceCommitTaskLinks("user_1", "repo_db_1", "abc123", ["card_1", "card_2"]);

    expect(prisma.gitHubActivity.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.gitHubActivityTaskLink.createMany).toHaveBeenCalledWith({
      data: [
        { activityId: "activity_1", cardId: "card_1" },
        { activityId: "activity_1", cardId: "card_2" }
      ],
      skipDuplicates: true
    });
    expect(payload?.tasks).toHaveLength(2);
    expect(payload?.activity.taggedTaskCount).toBe(2);
  });

  it("persists task links for a pull request without affecting commit tagging state", async () => {
    const linkedCard = {
      id: "card_pr_1",
      boardId: "board_1",
      asanaTaskGid: "1200001001",
      asanaParentTaskGid: "1200001000",
      asanaRootTaskGid: "1200001000",
      nestingDepth: 0,
      title: "PR task",
      statusKey: "review",
      board: { id: "board_1", name: "Board One" }
    };

    const prisma = {
      gitHubInstallation: {
        count: vi.fn().mockResolvedValue(1)
      },
      gitHubRepository: {
        findFirst: vi.fn().mockResolvedValue({
          id: "repo_db_1",
          fullName: "Emergence-Mobility/Emergence_Webapp_Backend",
          githubInstallation: {
            githubInstallationId: BigInt(123)
          }
        })
      },
      card: {
        findMany: vi.fn().mockResolvedValue([linkedCard])
      },
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: "activity_pr_1",
            activityType: "pull_request",
            title: "feat: tagged pull request",
            url: "https://github.com/example/repo/pull/42",
            state: "open",
            sha: null,
            pullRequestNumber: 42,
            branchName: "feature/pr-tagging",
            authoredAt: new Date("2026-05-18T10:00:00Z"),
            authorName: "Hari",
            authorLogin: "hari",
            taskLinks: [{ card: linkedCard }]
          })
          .mockResolvedValueOnce({
            id: "activity_pr_1",
            activityType: "pull_request",
            title: "feat: tagged pull request",
            url: "https://github.com/example/repo/pull/42",
            state: "open",
            sha: null,
            pullRequestNumber: 42,
            branchName: "feature/pr-tagging",
            authoredAt: new Date("2026-05-18T10:00:00Z"),
            authorName: "Hari",
            authorLogin: "hari",
            taskLinks: [{ card: linkedCard }]
          }),
        upsert: vi.fn().mockResolvedValue({ id: "activity_pr_1" })
      },
      gitHubActivityTaskLink: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    } as any;

    const octokit = {
      request: vi.fn(async (route: string) => {
        if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}") {
          return {
            data: {
              title: "feat: tagged pull request",
              html_url: "https://github.com/example/repo/pull/42",
              merged_at: null,
              state: "open",
              created_at: "2026-05-18T10:00:00Z",
              user: { login: "hari" },
              head: { ref: "feature/pr-tagging" }
            }
          };
        }

        throw new Error(`Unexpected route: ${route}`);
      })
    };

    const githubService = {
      getInstallationOctokit: vi.fn().mockResolvedValue(octokit)
    } as any;

    const service = createRepositoryCommitGraphService(prisma, githubService);
    const payload = await service.replacePullRequestTaskLinks("user_1", "repo_db_1", 42, ["card_pr_1"]);

    expect(prisma.gitHubActivity.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.gitHubActivityTaskLink.createMany).toHaveBeenCalledWith({
      data: [
        { activityId: "activity_pr_1", cardId: "card_pr_1" }
      ],
      skipDuplicates: true
    });
    expect(payload?.tasks).toHaveLength(1);
    expect(payload?.activity.pullRequestNumber).toBe(42);
    expect(payload?.activity.type).toBe("pull_request");
    expect(payload?.activity.taggedTaskCount).toBe(1);
  });

  it("keeps tagged task previews isolated per commit when stored activities return mixed ordering", async () => {
    const prisma = {
      gitHubInstallation: {
        count: vi.fn().mockResolvedValue(1)
      },
      gitHubRepository: {
        findFirst: vi.fn().mockResolvedValue({
          id: "repo_db_1",
          fullName: "Emergence-Mobility/Emergence_Webapp_Backend",
          githubInstallation: {
            githubInstallationId: BigInt(123)
          }
        })
      },
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "activity_commit_2",
            activityType: "commit",
            sha: "sha-2",
            pullRequestNumber: null,
            taskLinks: [
              {
                card: {
                  id: "card_2",
                  boardId: "board_1",
                  asanaTaskGid: "1200000002",
                  asanaParentTaskGid: "1200000000",
                  asanaRootTaskGid: "1200000000",
                  nestingDepth: 0,
                  title: "Task two",
                  statusKey: "review",
                  board: { id: "board_1", name: "Board One" }
                }
              }
            ]
          },
          {
            id: "activity_commit_1",
            activityType: "commit",
            sha: "sha-1",
            pullRequestNumber: null,
            taskLinks: [
              {
                card: {
                  id: "card_1",
                  boardId: "board_1",
                  asanaTaskGid: "1200000001",
                  asanaParentTaskGid: "1200000000",
                  asanaRootTaskGid: "1200000000",
                  nestingDepth: 0,
                  title: "Task one",
                  statusKey: "active",
                  board: { id: "board_1", name: "Board One" }
                }
              }
            ]
          }
        ])
      }
    } as any;

    const octokit = {
      request: vi.fn(async (route: string) => {
        if (route === "GET /repos/{owner}/{repo}") {
          return {
            data: {
              name: "Emergence_Webapp_Backend",
              full_name: "Emergence-Mobility/Emergence_Webapp_Backend",
              default_branch: "main",
              html_url: "https://github.com/Emergence-Mobility/Emergence_Webapp_Backend"
            }
          };
        }

        if (route === "GET /repos/{owner}/{repo}/commits/{ref}") {
          return {
            data: {
              commit: {
                committer: {
                  date: "2026-05-18T10:00:00Z"
                }
              }
            }
          };
        }

        if (route === "GET /repos/{owner}/{repo}/branches") {
          return {
            data: [{ name: "main", commit: { sha: "sha-2" } }]
          };
        }

        throw new Error(`Unexpected route: ${route}`);
      }),
      graphql: vi.fn(async () => ({
        repository: {
          ref: {
            target: {
              history: {
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null
                },
                nodes: [
                  {
                    oid: "sha-2",
                    abbreviatedOid: "sha-2",
                    messageHeadline: "commit-2",
                    messageBody: "",
                    committedDate: "2026-05-18T12:00:00Z",
                    authoredDate: "2026-05-18T12:00:00Z",
                    additions: 1,
                    deletions: 0,
                    changedFilesIfAvailable: 1,
                    url: "https://github.com/commit/sha-2",
                    parents: { nodes: [{ oid: "sha-1" }] },
                    author: { name: "Hari", user: { login: "hari", avatarUrl: "https://example.com/a.png" } },
                    associatedPullRequests: { nodes: [] }
                  },
                  {
                    oid: "sha-1",
                    abbreviatedOid: "sha-1",
                    messageHeadline: "commit-1",
                    messageBody: "",
                    committedDate: "2026-05-18T11:00:00Z",
                    authoredDate: "2026-05-18T11:00:00Z",
                    additions: 1,
                    deletions: 0,
                    changedFilesIfAvailable: 1,
                    url: "https://github.com/commit/sha-1",
                    parents: { nodes: [] },
                    author: { name: "Hari", user: { login: "hari", avatarUrl: "https://example.com/a.png" } },
                    associatedPullRequests: { nodes: [] }
                  }
                ]
              }
            }
          }
        }
      }))
    };

    const githubService = {
      getInstallationOctokit: vi.fn().mockResolvedValue(octokit)
    } as any;

    const service = createRepositoryCommitGraphService(prisma, githubService);
    const payload = await service.getRepositoryCommitGraph("user_1", "repo_db_1", "all");

    expect(payload.commits.find((commit) => commit.sha === "sha-1")?.taggedTaskCount).toBe(1);
    expect(payload.commits.find((commit) => commit.sha === "sha-1")?.taggedTasksPreview.map((task) => task.id)).toEqual(["card_1"]);
    expect(payload.commits.find((commit) => commit.sha === "sha-2")?.taggedTaskCount).toBe(1);
    expect(payload.commits.find((commit) => commit.sha === "sha-2")?.taggedTasksPreview.map((task) => task.id)).toEqual(["card_2"]);
  });

  it("searches commits by sha and ranks matches", async () => {
    const prisma = {
      gitHubInstallation: {
        count: vi.fn().mockResolvedValue(1)
      },
      gitHubRepository: {
        findFirst: vi.fn().mockResolvedValue({
          id: "repo_db_1",
          fullName: "Emergence-Mobility/Emergence_Webapp_Backend",
          githubInstallation: {
            githubInstallationId: BigInt(123)
          }
        })
      },
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([])
      }
    } as any;

    const octokit = {
      request: vi.fn(async (route: string) => {
        if (route === "GET /repos/{owner}/{repo}/commits/{ref}") {
          return {
            data: {
              sha: "abc1234567890abcdef1234567890abcdef123456",
              html_url: "https://github.com/example/repo/commit/abc123",
              author: { login: "hari", avatar_url: "https://avatars.example/hari" },
              parents: [],
              stats: { additions: 2, deletions: 1, total: 3 },
              commit: {
                message: "feat: webhook replay",
                author: { name: "Hari", date: "2026-05-18T10:00:00Z" },
                committer: { date: "2026-05-18T10:00:00Z" }
              }
            }
          };
        }

        throw new Error(`Unexpected route: ${route}`);
      })
    };

    const githubService = {
      getInstallationOctokit: vi.fn().mockResolvedValue(octokit)
    } as any;

    const service = createRepositoryCommitGraphService(prisma, githubService);
    const payload = await service.searchRepositoryCommits("user_1", "repo_db_1", "abc1234", 7);

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.commit.sha).toContain("abc123");
    expect(payload.items[0]?.matchLabel).toMatch(/SHA/i);
  });

  it("loads a commit by sha outside the graph page", async () => {
    const prisma = {
      gitHubInstallation: {
        count: vi.fn().mockResolvedValue(1)
      },
      gitHubRepository: {
        findFirst: vi.fn().mockResolvedValue({
          id: "repo_db_1",
          fullName: "Emergence-Mobility/Emergence_Webapp_Backend",
          githubInstallation: {
            githubInstallationId: BigInt(123)
          }
        })
      },
      gitHubActivity: {
        findMany: vi.fn().mockResolvedValue([])
      }
    } as any;

    const octokit = {
      request: vi.fn(async (route: string) => {
        if (route === "GET /repos/{owner}/{repo}/commits/{ref}") {
          return {
            data: {
              sha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
              html_url: "https://github.com/example/repo/commit/deadbeef",
              author: { login: "hari" },
              parents: [{ sha: "parentsha" }],
              stats: { additions: 1, deletions: 0, total: 1 },
              commit: {
                message: "chore: older commit",
                author: { name: "Hari", date: "2026-05-01T10:00:00Z" },
                committer: { date: "2026-05-01T10:00:00Z" }
              }
            }
          };
        }

        throw new Error(`Unexpected route: ${route}`);
      })
    };

    const githubService = {
      getInstallationOctokit: vi.fn().mockResolvedValue(octokit)
    } as any;

    const service = createRepositoryCommitGraphService(prisma, githubService);
    const commit = await service.getRepositoryCommitBySha(
      "user_1",
      "repo_db_1",
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
    );

    expect(commit.messageHeadline).toBe("chore: older commit");
    expect(commit.shortSha).toBe("deadbee");
  });
});
