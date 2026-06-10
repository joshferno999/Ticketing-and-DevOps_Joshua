import type { PrismaClient } from "@prisma/client";
import type {
  CommitTaskLinksResponse,
  GitHubActivitySummary,
  RepositoryBranchOption,
  RepositoryCommitGraphResponse,
  RepositoryCommitNode,
  RepositoryCommitPullRequestSummary,
  RepositoryCommitSearchResponse,
  RepositoryPullRequestListResponse,
  RepositoryPullRequestSummary,
  PullRequestTaskLinksResponse,
  TaskLinkableCardSummary,
  TaskSearchResult
} from "@emergence-devops/shared";
import { ForbiddenError, NotFoundError } from "../../lib/errors";
import {
  commitShaCandidates,
  isLikelyCommitSha,
  mapRestCommitToRepositoryCommitNode,
  rankCommitMatches
} from "./commit-search";
import { repairGitHubActivityPersistence } from "./github-activity-repair";
import type { createGitHubService } from "./github.service";

const MAX_INCLUDED_BRANCHES = 8;
const DEFAULT_PAGE_LIMIT = 60;
const GITHUB_HISTORY_PAGE_SIZE = 50;
const MAX_GITHUB_HISTORY_PAGE_REQUESTS = 64;

type CommitGraphScope = "all" | "branch";

interface BranchHeadMetadata {
  name: string;
  headSha: string;
  committedAt: string;
}

interface BranchHistoryPage {
  commits: RepositoryCommitNode[];
  endCursor: string | null;
  hasNextPage: boolean;
}

interface GraphQLBranchHistoryResponse {
  repository: {
    ref: null | {
      name: string;
      target: {
        oid: string;
        history: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          nodes: Array<{
            oid: string;
            abbreviatedOid: string;
            messageHeadline: string;
            messageBody: string;
            committedDate: string;
            authoredDate: string;
            additions: number;
            deletions: number;
            changedFilesIfAvailable: number | null;
            url: string;
            parents: {
              nodes: Array<{
                oid: string;
              }>;
            };
            author: {
              name: string | null;
              user: null | {
                login: string;
                avatarUrl: string;
              };
            } | null;
            associatedPullRequests: {
              nodes: Array<{
                id: string;
                number: number;
                title: string;
                state: "OPEN" | "CLOSED";
                merged: boolean;
                url: string;
              }>;
            };
          }>;
        };
      };
    };
  };
}

type RepositoryRecord = {
  id: string;
  fullName: string;
  githubInstallation: {
    githubInstallationId: bigint;
  };
};

const activityTaskLinkInclude = {
  taskLinks: {
    include: {
      card: {
        include: {
          board: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  }
} as const;

export function createRepositoryCommitGraphService(
  prisma: PrismaClient,
  githubService: ReturnType<typeof createGitHubService>
) {
  async function assertGitHubConnected(_appUserId: string) {
    const installationCount = await prisma.gitHubInstallation.count();

    if (installationCount === 0) {
      throw new ForbiddenError("Connect GitHub App in Settings to access repositories.");
    }
  }

  async function requireManagedRepository(appUserId: string, repositoryId: string) {
    await assertGitHubConnected(appUserId);
    const repository = await getManagedRepository(appUserId, repositoryId);
    if (!repository) {
      throw new NotFoundError("Repository not found or no longer granted.");
    }

    return repository;
  }

  async function getRepositoryCommitGraph(
    appUserId: string,
    repositoryId: string,
    scope: CommitGraphScope,
    branch?: string,
    offset = 0,
    limit = DEFAULT_PAGE_LIMIT
  ): Promise<RepositoryCommitGraphResponse> {
    const storedRepository = await requireManagedRepository(appUserId, repositoryId);

    const [owner, repo] = storedRepository.fullName.split("/");
    if (!owner || !repo) {
      throw new Error(`Repository name is invalid: ${storedRepository.fullName}`);
    }

    const octokit = await githubService.getInstallationOctokit(Number(storedRepository.githubInstallation.githubInstallationId));
    const [repositoryResponse, branchesResponse] = await Promise.all([
      octokit.request("GET /repos/{owner}/{repo}", {
        owner,
        repo
      }),
      listRepositoryBranches(octokit, owner, repo)
    ]);

    const defaultBranch = repositoryResponse.data.default_branch;
    const branchMetadata = await loadBranchHeadMetadata(octokit, owner, repo, branchesResponse);
    const selectedBranches = selectBranches(branchMetadata, defaultBranch, scope, branch);
    if (scope === "branch" && selectedBranches.length === 0) {
      throw new NotFoundError("Branch not found for this repository.");
    }

    const branchHeadLookup = new Map<string, string[]>();
    for (const selectedBranch of selectedBranches) {
      const current = branchHeadLookup.get(selectedBranch.headSha) ?? [];
      current.push(selectedBranch.name);
      branchHeadLookup.set(selectedBranch.headSha, current);
    }

    const dedupedCommitMap = new Map<string, RepositoryCommitNode>();
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const targetCommitCount = safeOffset + safeLimit;
    const branchStates = selectedBranches.map((selectedBranch) => ({
      name: selectedBranch.name,
      cursor: null as string | null,
      hasNextPage: true
    }));

    let githubHistoryRequests = 0;
    while (githubHistoryRequests < MAX_GITHUB_HISTORY_PAGE_REQUESTS) {
      const activeBranches = branchStates.filter((branchState) => branchState.hasNextPage);
      if (activeBranches.length === 0) {
        break;
      }

      const pageResults = await Promise.all(
        activeBranches.map((branchState) =>
          fetchBranchHistoryPage(octokit, owner, repo, branchState.name, branchState.cursor)
        )
      );

      githubHistoryRequests += activeBranches.length;

      for (let index = 0; index < activeBranches.length; index += 1) {
        const branchState = activeBranches[index]!;
        const page = pageResults[index]!;
        branchState.cursor = page.endCursor;
        branchState.hasNextPage = page.hasNextPage;

        for (const commit of page.commits) {
          if (!dedupedCommitMap.has(commit.sha)) {
            dedupedCommitMap.set(commit.sha, {
              ...commit,
              branchHeadNames: branchHeadLookup.get(commit.sha) ?? []
            });
          }
        }
      }

      const currentOrderedCount = topologicallySortRepositoryCommits(
        Array.from(dedupedCommitMap.values()),
        targetCommitCount
      ).length;

      if (currentOrderedCount >= targetCommitCount) {
        break;
      }
    }

    const exhaustedGitHubHistory = branchStates.every((branchState) => !branchState.hasNextPage);
    const orderedCommits = topologicallySortRepositoryCommits(
      Array.from(dedupedCommitMap.values()),
      exhaustedGitHubHistory ? Number.POSITIVE_INFINITY : targetCommitCount
    );

    const branchOptions: RepositoryBranchOption[] = branchMetadata.map((item) => ({
      name: item.name,
      headSha: item.headSha,
      isDefault: item.name === defaultBranch,
      isIncludedInCurrentScope: selectedBranches.some((selectedBranch) => selectedBranch.name === item.name)
    }));

    const pagedCommits = orderedCommits.slice(safeOffset, safeOffset + safeLimit);
    const activityPreviewMaps = await loadActivityPreviewMaps(
      storedRepository.id,
      pagedCommits.map((commit) => commit.sha),
      pagedCommits.flatMap((commit) => (commit.pullRequest ? [commit.pullRequest.number] : []))
    );
    const hasMore =
      safeOffset + pagedCommits.length < orderedCommits.length ||
      (!exhaustedGitHubHistory && pagedCommits.length === safeLimit);

    return {
      repo: {
        id: storedRepository.id,
        name: repositoryResponse.data.name,
        fullName: repositoryResponse.data.full_name,
        defaultBranch,
        htmlUrl: repositoryResponse.data.html_url
      },
      branchOptions,
      commits: pagedCommits.map((commit) => ({
        ...commit,
        taggedTaskCount: activityPreviewMaps.commitCounts.get(commit.sha) ?? 0,
        taggedTasksPreview: activityPreviewMaps.commitTasks.get(commit.sha) ?? []
      })),
      pageInfo: {
        offset: safeOffset,
        limit: safeLimit,
        hasMore,
        nextOffset: hasMore ? safeOffset + pagedCommits.length : null,
        totalCommits: exhaustedGitHubHistory ? orderedCommits.length : null
      }
    };
  }

  async function getRepositoryPullRequests(
    appUserId: string,
    repositoryId: string,
    offset = 0,
    limit = 20
  ): Promise<RepositoryPullRequestListResponse> {
    const storedRepository = await requireManagedRepository(appUserId, repositoryId);

    const [owner, repo] = storedRepository.fullName.split("/");
    if (!owner || !repo) {
      throw new Error(`Repository name is invalid: ${storedRepository.fullName}`);
    }

    const octokit = await githubService.getInstallationOctokit(
      Number(storedRepository.githubInstallation.githubInstallationId)
    );
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const page = Math.floor(safeOffset / safeLimit) + 1;
    const response = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: safeLimit,
      page
    });

    const activityPreviewMaps = await loadActivityPreviewMaps(
      storedRepository.id,
      [],
      response.data.map((pullRequest) => pullRequest.number)
    );

    const pullRequests: RepositoryPullRequestSummary[] = response.data.map((pullRequest) => ({
      id: String(pullRequest.id),
      number: pullRequest.number,
      title: pullRequest.title,
      state: pullRequest.merged_at
        ? "MERGED"
        : pullRequest.state === "open"
          ? "OPEN"
          : "CLOSED",
      url: pullRequest.html_url,
      authorName: pullRequest.user?.login ?? "Unknown author",
      authorLogin: pullRequest.user?.login ?? undefined,
      createdAt: pullRequest.created_at,
      updatedAt: pullRequest.updated_at,
      mergedAt: pullRequest.merged_at ?? undefined,
      branchName: pullRequest.head.ref,
      taggedTaskCount: activityPreviewMaps.pullRequestCounts.get(pullRequest.number) ?? 0,
      taggedTasksPreview: activityPreviewMaps.pullRequestTasks.get(pullRequest.number) ?? []
    }));

    const hasMore = pullRequests.length === safeLimit;

    return {
      pullRequests,
      pageInfo: {
        offset: safeOffset,
        limit: safeLimit,
        hasMore,
        nextOffset: hasMore ? safeOffset + pullRequests.length : null,
        totalPullRequests: null
      }
    };
  }

  async function searchRepositoryTasks(
    appUserId: string,
    repositoryId: string,
    query: string
  ): Promise<TaskSearchResult> {
    await requireManagedRepository(appUserId, repositoryId);

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
            name: true
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
      items: cards.map((card) => toTaskSummary(card, cardsByTaskGid))
    };
  }

  async function enrichCommitsWithActivityPreviews(
    repositoryDbId: string,
    commits: RepositoryCommitNode[]
  ): Promise<RepositoryCommitNode[]> {
    if (commits.length === 0) {
      return [];
    }

    const activityPreviewMaps = await loadActivityPreviewMaps(
      repositoryDbId,
      commits.map((commit) => commit.sha),
      []
    );

    return commits.map((commit) => ({
      ...commit,
      taggedTaskCount: activityPreviewMaps.commitCounts.get(commit.sha) ?? 0,
      taggedTasksPreview: activityPreviewMaps.commitTasks.get(commit.sha) ?? []
    }));
  }

  async function fetchRestCommitByRef(
    octokit: Awaited<ReturnType<ReturnType<typeof createGitHubService>["getInstallationOctokit"]>>,
    owner: string,
    repo: string,
    ref: string
  ): Promise<RepositoryCommitNode | null> {
    try {
      const response = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
        owner,
        repo,
        ref
      });

      return mapRestCommitToRepositoryCommitNode(response.data);
    } catch (cause) {
      if (typeof cause === "object" && cause && "status" in cause && cause.status === 404) {
        return null;
      }

      throw cause;
    }
  }

  async function getRepositoryCommitBySha(
    appUserId: string,
    repositoryId: string,
    sha: string
  ): Promise<RepositoryCommitNode> {
    const storedRepository = await requireManagedRepository(appUserId, repositoryId);
    const [owner, repo] = storedRepository.fullName.split("/");
    if (!owner || !repo) {
      throw new Error(`Repository name is invalid: ${storedRepository.fullName}`);
    }

    const octokit = await githubService.getInstallationOctokit(
      Number(storedRepository.githubInstallation.githubInstallationId)
    );
    const commit = await fetchRestCommitByRef(octokit, owner, repo, sha);
    if (!commit) {
      throw new NotFoundError("Commit not found or repository no longer granted.");
    }

    const [enrichedCommit] = await enrichCommitsWithActivityPreviews(storedRepository.id, [commit]);
    return enrichedCommit ?? commit;
  }

  async function searchRepositoryCommits(
    appUserId: string,
    repositoryId: string,
    query: string,
    limit = 7
  ): Promise<RepositoryCommitSearchResponse> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return { items: [] };
    }

    const storedRepository = await requireManagedRepository(appUserId, repositoryId);
    const [owner, repo] = storedRepository.fullName.split("/");
    if (!owner || !repo) {
      throw new Error(`Repository name is invalid: ${storedRepository.fullName}`);
    }

    const octokit = await githubService.getInstallationOctokit(
      Number(storedRepository.githubInstallation.githubInstallationId)
    );
    const candidates: RepositoryCommitNode[] = [];
    const seenShas = new Set<string>();

    function addCandidate(commit: RepositoryCommitNode | null) {
      if (!commit || seenShas.has(commit.sha)) {
        return;
      }

      seenShas.add(commit.sha);
      candidates.push(commit);
    }

    if (isLikelyCommitSha(trimmedQuery)) {
      for (const shaCandidate of commitShaCandidates(trimmedQuery)) {
        const commit = await fetchRestCommitByRef(octokit, owner, repo, shaCandidate);
        addCandidate(commit);
      }
    }

    const shouldSearchByText = trimmedQuery.length >= 2;
    if (shouldSearchByText) {
      try {
        const searchResponse = await octokit.request("GET /search/commits", {
          q: `repo:${owner}/${repo} ${trimmedQuery}`,
          per_page: 30,
          sort: "committer-date",
          order: "desc"
        });

        for (const item of searchResponse.data.items ?? []) {
          addCandidate(mapRestCommitToRepositoryCommitNode(item));
        }
      } catch (cause) {
        if (candidates.length === 0) {
          throw cause;
        }
      }
    }

    const enrichedCandidates = await enrichCommitsWithActivityPreviews(storedRepository.id, candidates);
    return {
      items: rankCommitMatches(trimmedQuery, enrichedCandidates, Math.min(Math.max(limit, 1), 7))
    };
  }

  async function getCommitTaskLinks(
    appUserId: string,
    repositoryId: string,
    sha: string
  ): Promise<CommitTaskLinksResponse | null> {
    const storedRepository = await requireManagedRepository(appUserId, repositoryId);
    await repairGitHubActivityPersistence(prisma, {
      repositoryId: storedRepository.id,
      sha
    });

    const activity = await findCommitActivity(storedRepository.id, sha);
    if (activity) {
      return {
        activity: toGitHubActivitySummary(activity),
        tasks: activity.taskLinks.map((taskLink) => toTaskSummary(taskLink.card, new Map()))
      };
    }

    const hydrated = await fetchCommitActivitySnapshot(storedRepository, sha);
    if (!hydrated) {
      return null;
    }

    return {
      activity: {
        ...hydrated,
        taggedTaskCount: 0,
        taggedTasksPreview: []
      },
      tasks: []
    };
  }

  async function replaceCommitTaskLinks(
    appUserId: string,
    repositoryId: string,
    sha: string,
    cardIds: string[]
  ): Promise<CommitTaskLinksResponse | null> {
    const storedRepository = await requireManagedRepository(appUserId, repositoryId);
    await repairGitHubActivityPersistence(prisma, {
      repositoryId: storedRepository.id,
      sha
    });

    const cards = await loadValidatedCards(cardIds);
    const existingActivity = await findCommitActivity(storedRepository.id, sha);
    let hasActivity = Boolean(existingActivity);
    if (!existingActivity && cardIds.length > 0) {
      const snapshot = await fetchCommitActivitySnapshot(storedRepository, sha);
      if (!snapshot) {
        return null;
      }

      await upsertCommitActivity(storedRepository.id, snapshot);
      hasActivity = true;
    }

    if (hasActivity) {
      const activity = await findCommitActivity(storedRepository.id, sha);
      if (activity) {
        await replaceActivityTaskLinks(activity.id, cards);
      }
    }

    const refreshedActivity = hasActivity
      ? await findCommitActivity(storedRepository.id, sha)
      : null;

    if (refreshedActivity) {
      return {
        activity: toGitHubActivitySummary(refreshedActivity),
        tasks: refreshedActivity.taskLinks.map((taskLink) => toTaskSummary(taskLink.card, new Map()))
      };
    }

    const fallback = await fetchCommitActivitySnapshot(storedRepository, sha);
    if (!fallback) {
      return null;
    }

    return {
      activity: {
        ...fallback,
        taggedTaskCount: 0,
        taggedTasksPreview: []
      },
      tasks: []
    };
  }

  async function getPullRequestTaskLinks(
    appUserId: string,
    repositoryId: string,
    pullRequestNumber: number
  ): Promise<PullRequestTaskLinksResponse | null> {
    const storedRepository = await requireManagedRepository(appUserId, repositoryId);
    await repairGitHubActivityPersistence(prisma, {
      repositoryId: storedRepository.id,
      pullRequestNumber
    });

    const activity = await findPullRequestActivity(storedRepository.id, pullRequestNumber);
    if (activity) {
      return {
        activity: toGitHubActivitySummary(activity),
        tasks: activity.taskLinks.map((taskLink) => toTaskSummary(taskLink.card, new Map()))
      };
    }

    const hydrated = await fetchPullRequestActivitySnapshot(storedRepository, pullRequestNumber);
    if (!hydrated) {
      return null;
    }

    return {
      activity: {
        ...hydrated,
        taggedTaskCount: 0,
        taggedTasksPreview: []
      },
      tasks: []
    };
  }

  async function replacePullRequestTaskLinks(
    appUserId: string,
    repositoryId: string,
    pullRequestNumber: number,
    cardIds: string[]
  ): Promise<PullRequestTaskLinksResponse | null> {
    const storedRepository = await requireManagedRepository(appUserId, repositoryId);
    await repairGitHubActivityPersistence(prisma, {
      repositoryId: storedRepository.id,
      pullRequestNumber
    });

    const cards = await loadValidatedCards(cardIds);
    const existingActivity = await findPullRequestActivity(storedRepository.id, pullRequestNumber);
    let hasActivity = Boolean(existingActivity);
    if (!existingActivity && cardIds.length > 0) {
      const snapshot = await fetchPullRequestActivitySnapshot(storedRepository, pullRequestNumber);
      if (!snapshot) {
        return null;
      }

      await upsertPullRequestActivity(storedRepository.id, snapshot);
      hasActivity = true;
    }

    if (hasActivity) {
      const activity = await findPullRequestActivity(storedRepository.id, pullRequestNumber);
      if (activity) {
        await replaceActivityTaskLinks(activity.id, cards);
      }
    }

    const refreshedActivity = hasActivity
      ? await findPullRequestActivity(storedRepository.id, pullRequestNumber)
      : null;

    if (refreshedActivity) {
      return {
        activity: toGitHubActivitySummary(refreshedActivity),
        tasks: refreshedActivity.taskLinks.map((taskLink) => toTaskSummary(taskLink.card, new Map()))
      };
    }

    const fallback = await fetchPullRequestActivitySnapshot(storedRepository, pullRequestNumber);
    if (!fallback) {
      return null;
    }

    return {
      activity: {
        ...fallback,
        taggedTaskCount: 0,
        taggedTasksPreview: []
      },
      tasks: []
    };
  }

  async function loadBranchHeadMetadata(
    octokit: Awaited<ReturnType<ReturnType<typeof createGitHubService>["getInstallationOctokit"]>>,
    owner: string,
    repo: string,
    branches: Array<{ name: string; commit: { sha: string } }>
  ) {
    const branchMetadata = await Promise.all(
      branches.map(async (branch) => {
        const commitResponse = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
          owner,
          repo,
          ref: branch.name
        });

        return {
          name: branch.name,
          headSha: branch.commit.sha,
          committedAt: commitResponse.data.commit.committer?.date ?? commitResponse.data.commit.author?.date ?? new Date(0).toISOString()
        } satisfies BranchHeadMetadata;
      })
    );

    return branchMetadata.sort((left, right) => {
      if (left.name === right.name) {
        return 0;
      }

      return left.name.localeCompare(right.name);
    });
  }

  function selectBranches(
    branches: BranchHeadMetadata[],
    defaultBranch: string,
    scope: CommitGraphScope,
    requestedBranch?: string
  ) {
    if (scope === "branch") {
      return branches.filter((branch) => branch.name === requestedBranch);
    }

    const defaultBranchEntry = branches.find((branch) => branch.name === defaultBranch);
    const nonDefaultBranches = branches
      .filter((branch) => branch.name !== defaultBranch)
      .sort((left, right) => {
        const dateDelta = Date.parse(right.committedAt) - Date.parse(left.committedAt);
        if (dateDelta !== 0) {
          return dateDelta;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, MAX_INCLUDED_BRANCHES - (defaultBranchEntry ? 1 : 0));

    return [defaultBranchEntry, ...nonDefaultBranches].filter(Boolean) as BranchHeadMetadata[];
  }

  async function fetchBranchHistoryPage(
    octokit: Awaited<ReturnType<ReturnType<typeof createGitHubService>["getInstallationOctokit"]>>,
    owner: string,
    repo: string,
    branchName: string,
    afterCursor?: string | null
  ): Promise<BranchHistoryPage> {
    const response = await octokit.graphql<GraphQLBranchHistoryResponse>(
      `
        query RepositoryBranchHistory($owner: String!, $repo: String!, $qualifiedName: String!, $historyFirst: Int!, $after: String) {
          repository(owner: $owner, name: $repo) {
            ref(qualifiedName: $qualifiedName) {
              name
              target {
                ... on Commit {
                  oid
                  history(first: $historyFirst, after: $after) {
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
                    nodes {
                      oid
                      abbreviatedOid
                      messageHeadline
                      messageBody
                      committedDate
                      authoredDate
                      additions
                      deletions
                      changedFilesIfAvailable
                      url
                      parents(first: 10) {
                        nodes {
                          oid
                        }
                      }
                      author {
                        name
                        user {
                          login
                          avatarUrl
                        }
                      }
                      associatedPullRequests(first: 1, orderBy: { field: UPDATED_AT, direction: DESC }) {
                        nodes {
                          id
                          number
                          title
                          state
                          merged
                          url
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      {
        owner,
        repo,
        qualifiedName: `refs/heads/${branchName}`,
        historyFirst: GITHUB_HISTORY_PAGE_SIZE,
        after: afterCursor ?? null
      }
    );

    const history = response.repository.ref?.target.history;
    const historyNodes = history?.nodes ?? [];
    return {
      commits: historyNodes.map<RepositoryCommitNode>((node) => ({
        sha: node.oid,
        shortSha: node.abbreviatedOid,
        messageHeadline: node.messageHeadline,
        messageBody: node.messageBody,
        authorName: node.author?.name ?? node.author?.user?.login ?? "Unknown author",
        authorLogin: node.author?.user?.login ?? undefined,
        authorAvatarUrl: node.author?.user?.avatarUrl ?? undefined,
        committedAt: node.committedDate,
        authoredAt: node.authoredDate,
        parentShas: node.parents.nodes.map((parent) => parent.oid),
        branchHeadNames: [],
        additions: node.additions,
        deletions: node.deletions,
        changedFiles: node.changedFilesIfAvailable ?? 0,
        htmlUrl: node.url,
        taggedTaskCount: 0,
        taggedTasksPreview: [],
        pullRequest: toPullRequestSummary(node.associatedPullRequests.nodes[0])
      })),
      endCursor: history?.pageInfo?.endCursor ?? null,
      hasNextPage: history?.pageInfo?.hasNextPage ?? false
    };
  }

  async function getManagedRepository(
    appUserId: string,
    repositoryId: string
  ): Promise<RepositoryRecord | null> {
    const repository = await prisma.gitHubRepository.findFirst({
      where: {
        id: repositoryId
      },
      include: {
        githubInstallation: true
      }
    });

    return repository;
  }

  async function loadActivityPreviewMaps(
    repositoryId: string,
    commitShas: string[],
    pullRequestNumbers: number[]
  ) {
    if (commitShas.length === 0 && pullRequestNumbers.length === 0) {
      return {
        commitCounts: new Map<string, number>(),
        commitTasks: new Map<string, TaskLinkableCardSummary[]>(),
        pullRequestCounts: new Map<number, number>(),
        pullRequestTasks: new Map<number, TaskLinkableCardSummary[]>()
      };
    }

    await repairGitHubActivityPersistence(prisma, {
      repositoryId
    });

    const activities = await prisma.gitHubActivity.findMany({
      where: {
        repositoryId,
        OR: [
          ...(commitShas.length > 0
            ? [
                {
                  sha: {
                    in: commitShas
                  }
                }
              ]
            : []),
          ...(pullRequestNumbers.length > 0
            ? [
                {
                  pullRequestNumber: {
                    in: pullRequestNumbers
                  }
                }
              ]
            : [])
        ]
      },
      include: activityTaskLinkInclude
    });

    const commitCounts = new Map<string, number>();
    const commitTasks = new Map<string, TaskLinkableCardSummary[]>();
    const pullRequestCounts = new Map<number, number>();
    const pullRequestTasks = new Map<number, TaskLinkableCardSummary[]>();

    for (const activity of activities) {
      const cardsByTaskGid = new Map(activity.taskLinks.map((taskLink) => [taskLink.card.asanaTaskGid, taskLink.card]));
      const linkedTasks = activity.taskLinks.map((taskLink) => toTaskSummary(taskLink.card, cardsByTaskGid));

      if (activity.activityType === "commit" && activity.sha) {
        const mergedTasks = dedupeTaskSummaries([...(commitTasks.get(activity.sha) ?? []), ...linkedTasks]);
        commitCounts.set(activity.sha, mergedTasks.length);
        commitTasks.set(activity.sha, mergedTasks.slice(0, 3));
      }

      if (activity.activityType === "pull_request" && typeof activity.pullRequestNumber === "number") {
        const mergedTasks = dedupeTaskSummaries([...(pullRequestTasks.get(activity.pullRequestNumber) ?? []), ...linkedTasks]);
        pullRequestCounts.set(activity.pullRequestNumber, mergedTasks.length);
        pullRequestTasks.set(activity.pullRequestNumber, mergedTasks.slice(0, 3));
      }
    }

    return {
      commitCounts,
      commitTasks,
      pullRequestCounts,
      pullRequestTasks
    };
  }

  async function loadValidatedCards(cardIds: string[]) {
    if (cardIds.length === 0) {
      return [];
    }

    const uniqueCardIds = [...new Set(cardIds)];
    const cards = await prisma.card.findMany({
      where: {
        id: {
          in: uniqueCardIds
        }
      },
      include: {
        board: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (cards.length !== uniqueCardIds.length) {
      throw new Error("One or more selected tasks are unavailable in this workspace.");
    }

    return cards;
  }

  async function replaceActivityTaskLinks(activityId: string, cards: Awaited<ReturnType<typeof loadValidatedCards>>) {
    const uniqueCardIds = [...new Set(cards.map((card) => card.id))];
    await prisma.gitHubActivityTaskLink.deleteMany({
      where: {
        activityId,
        ...(uniqueCardIds.length > 0
          ? {
              cardId: {
                notIn: uniqueCardIds
              }
            }
          : {})
      }
    });

    if (uniqueCardIds.length === 0) {
      await prisma.gitHubActivityTaskLink.deleteMany({
        where: {
          activityId
        }
      });
      return;
    }

    await prisma.gitHubActivityTaskLink.createMany({
      data: uniqueCardIds.map((cardId) => ({
        activityId,
        cardId
      })),
      skipDuplicates: true
    });
  }

  async function findCommitActivity(repositoryId: string, sha: string) {
    return prisma.gitHubActivity.findUnique({
      where: {
        repositoryId_sha: {
          repositoryId,
          sha
        }
      },
      include: activityTaskLinkInclude
    });
  }

  async function findPullRequestActivity(repositoryId: string, pullRequestNumber: number) {
    return prisma.gitHubActivity.findUnique({
      where: {
        repositoryId_pullRequestNumber: {
          repositoryId,
          pullRequestNumber
        }
      },
      include: activityTaskLinkInclude
    });
  }

  async function fetchCommitActivitySnapshot(
    repository: RepositoryRecord,
    sha: string
  ): Promise<Omit<GitHubActivitySummary, "taggedTaskCount" | "taggedTasksPreview"> | null> {
    const [owner, repo] = repository.fullName.split("/");
    if (!owner || !repo) {
      return null;
    }

    const octokit = await githubService.getInstallationOctokit(Number(repository.githubInstallation.githubInstallationId));
    let response;
    try {
      response = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
        owner,
        repo,
        ref: sha
      });
    } catch (cause) {
      if (typeof cause === "object" && cause && "status" in cause && cause.status === 404) {
        return null;
      }
      throw cause;
    }

    const headline = String(response.data.commit.message ?? "").split("\n")[0] ?? sha;
    return {
      id: `commit:${repository.id}:${sha}`,
      type: "commit",
      title: headline || sha,
      url: response.data.html_url,
      authoredAt: response.data.commit.author?.date ?? response.data.commit.committer?.date ?? new Date().toISOString(),
      authorName: response.data.author?.login ?? response.data.commit.author?.name ?? "Unknown author",
      authorLogin: response.data.author?.login ?? undefined,
      sha
    };
  }

  async function fetchPullRequestActivitySnapshot(
    repository: RepositoryRecord,
    pullRequestNumber: number
  ): Promise<Omit<GitHubActivitySummary, "taggedTaskCount" | "taggedTasksPreview"> | null> {
    const [owner, repo] = repository.fullName.split("/");
    if (!owner || !repo) {
      return null;
    }

    const octokit = await githubService.getInstallationOctokit(Number(repository.githubInstallation.githubInstallationId));
    let response;
    try {
      response = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: pullRequestNumber
      });
    } catch (cause) {
      if (typeof cause === "object" && cause && "status" in cause && cause.status === 404) {
        return null;
      }
      throw cause;
    }

    return {
      id: `pull_request:${repository.id}:${pullRequestNumber}`,
      type: "pull_request",
      title: response.data.title,
      url: response.data.html_url,
      state: response.data.merged_at
        ? "merged"
        : response.data.state === "open"
          ? "open"
          : "closed",
      authoredAt: response.data.created_at,
      authorName: response.data.user?.login ?? "Unknown author",
      authorLogin: response.data.user?.login ?? undefined,
      pullRequestNumber,
      branchName: response.data.head.ref
    };
  }

  async function upsertCommitActivity(
    repositoryId: string,
    snapshot: Omit<GitHubActivitySummary, "taggedTaskCount" | "taggedTasksPreview">
  ) {
    return prisma.gitHubActivity.upsert({
      where: {
        repositoryId_sha: {
          repositoryId,
          sha: snapshot.sha!
        }
      },
      update: {
        title: snapshot.title,
        url: snapshot.url,
        state: snapshot.state,
        branchName: snapshot.branchName,
        authorName: snapshot.authorName,
        authorLogin: snapshot.authorLogin,
        authoredAt: new Date(snapshot.authoredAt)
      },
      create: {
        repositoryId,
        activityType: "commit",
        title: snapshot.title,
        url: snapshot.url,
        state: snapshot.state,
        sha: snapshot.sha,
        branchName: snapshot.branchName,
        authorName: snapshot.authorName,
        authorLogin: snapshot.authorLogin,
        authoredAt: new Date(snapshot.authoredAt)
      }
    });
  }

  async function upsertPullRequestActivity(
    repositoryId: string,
    snapshot: Omit<GitHubActivitySummary, "taggedTaskCount" | "taggedTasksPreview">
  ) {
    return prisma.gitHubActivity.upsert({
      where: {
        repositoryId_pullRequestNumber: {
          repositoryId,
          pullRequestNumber: snapshot.pullRequestNumber!
        }
      },
      update: {
        title: snapshot.title,
        url: snapshot.url,
        state: snapshot.state,
        branchName: snapshot.branchName,
        authorName: snapshot.authorName,
        authorLogin: snapshot.authorLogin,
        authoredAt: new Date(snapshot.authoredAt)
      },
      create: {
        repositoryId,
        activityType: "pull_request",
        title: snapshot.title,
        url: snapshot.url,
        state: snapshot.state,
        pullRequestNumber: snapshot.pullRequestNumber,
        branchName: snapshot.branchName,
        authorName: snapshot.authorName,
        authorLogin: snapshot.authorLogin,
        authoredAt: new Date(snapshot.authoredAt)
      }
    });
  }

  return {
    getRepositoryCommitGraph,
    getRepositoryPullRequests,
    searchRepositoryTasks,
    searchRepositoryCommits,
    getRepositoryCommitBySha,
    getCommitTaskLinks,
    replaceCommitTaskLinks,
    getPullRequestTaskLinks,
    replacePullRequestTaskLinks
  };
}

async function listRepositoryBranches(
  octokit: Awaited<ReturnType<ReturnType<typeof createGitHubService>["getInstallationOctokit"]>>,
  owner: string,
  repo: string
) {
  const branches: Array<{ name: string; commit: { sha: string } }> = [];

  for (let page = 1; page <= 10; page += 1) {
    const response = await octokit.request("GET /repos/{owner}/{repo}/branches", {
      owner,
      repo,
      per_page: 100,
      page
    });

    branches.push(...response.data.map((branch) => ({
      name: branch.name,
      commit: {
        sha: branch.commit.sha
      }
    })));

    if (response.data.length < 100) {
      break;
    }
  }

  return branches;
}

function toPullRequestSummary(pullRequest?: {
  id: string;
  number: number;
  title: string;
  state: "OPEN" | "CLOSED";
  merged: boolean;
  url: string;
}): RepositoryCommitPullRequestSummary | undefined {
  if (!pullRequest) {
    return undefined;
  }

  return {
    id: pullRequest.id,
    number: pullRequest.number,
    title: pullRequest.title,
    state: pullRequest.merged ? "MERGED" : pullRequest.state,
    url: pullRequest.url
  };
}

function dedupeTaskSummaries(tasks: TaskLinkableCardSummary[]) {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    if (seen.has(task.id)) {
      return false;
    }
    seen.add(task.id);
    return true;
  });
}

function toTaskSummary(card: any, cardsByTaskGid: Map<string, any>): TaskLinkableCardSummary {
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

function toGitHubActivitySummary(activity: any): GitHubActivitySummary {
  const cardsByTaskGid = new Map<string, any>(activity.taskLinks.map((taskLink: any) => [taskLink.card.asanaTaskGid, taskLink.card]));
  const taggedTasks = activity.taskLinks.map((taskLink: any) => toTaskSummary(taskLink.card, cardsByTaskGid));

  return {
    id: activity.id,
    type: activity.activityType as "commit" | "pull_request",
    title: activity.title,
    url: activity.url,
    state: (activity.state?.toLowerCase() as "open" | "merged" | "closed" | undefined) ?? undefined,
    authoredAt: activity.authoredAt.toISOString(),
    authorName: activity.authorName,
    authorLogin: activity.authorLogin ?? undefined,
    sha: activity.sha ?? undefined,
    pullRequestNumber: activity.pullRequestNumber ?? undefined,
    branchName: activity.branchName ?? undefined,
    taggedTaskCount: taggedTasks.length,
    taggedTasksPreview: taggedTasks.slice(0, 3)
  };
}

function compareCommitsByDateThenSha(left: RepositoryCommitNode, right: RepositoryCommitNode) {
  const dateDelta = Date.parse(right.committedAt) - Date.parse(left.committedAt);
  if (dateDelta !== 0) {
    return dateDelta;
  }

  return left.sha.localeCompare(right.sha);
}

export function topologicallySortRepositoryCommits(
  commits: RepositoryCommitNode[],
  limit = Number.POSITIVE_INFINITY
) {
  const commitMap = new Map(commits.map((commit) => [commit.sha, commit]));
  const childCount = new Map<string, number>(commits.map((commit) => [commit.sha, 0]));

  for (const commit of commits) {
    for (const parentSha of commit.parentShas) {
      if (!commitMap.has(parentSha)) {
        continue;
      }
      childCount.set(parentSha, (childCount.get(parentSha) ?? 0) + 1);
    }
  }

  const ready = commits
    .filter((commit) => (childCount.get(commit.sha) ?? 0) === 0)
    .sort(compareCommitsByDateThenSha);

  const ordered: RepositoryCommitNode[] = [];
  const seen = new Set<string>();

  while (ready.length > 0 && ordered.length < limit) {
    const next = ready.shift()!;
    if (seen.has(next.sha)) {
      continue;
    }

    seen.add(next.sha);
    ordered.push(next);

    for (const parentSha of next.parentShas) {
      if (!commitMap.has(parentSha)) {
        continue;
      }

      const remainingChildren = (childCount.get(parentSha) ?? 0) - 1;
      childCount.set(parentSha, remainingChildren);
      if (remainingChildren === 0) {
        ready.push(commitMap.get(parentSha)!);
        ready.sort(compareCommitsByDateThenSha);
      }
    }
  }

  if (ordered.length < Math.min(commits.length, limit)) {
    const fallbackCommits = commits
      .filter((commit) => !seen.has(commit.sha))
      .sort(compareCommitsByDateThenSha);

    for (const commit of fallbackCommits) {
      if (ordered.length >= limit) {
        break;
      }
      ordered.push(commit);
    }
  }

  return ordered;
}
