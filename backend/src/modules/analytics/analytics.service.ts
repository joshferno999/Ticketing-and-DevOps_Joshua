import type { AnalyticsSnapshot } from "@emergence-devops/shared";
import type { PrismaClient } from "@prisma/client";
import type { ServiceResult } from "../../lib/result";
import type { createGitHubService } from "../github/github.service";
import { buildAnalyticsReportBundle, type AnalyticsReportBundle } from "./analytics-builder";

type GitHubService = ReturnType<typeof createGitHubService>;

export function createAnalyticsService(prisma: PrismaClient, githubService: GitHubService) {
  async function getSnapshot(userId: string, weeks = 4): Promise<ServiceResult<AnalyticsSnapshot>> {
    const bundle = await getReportBundle(userId, weeks, { includeLiveGitHub: false });
    return {
      data: bundle.data.snapshot,
      source: "database"
    };
  }

  async function getReportBundle(
    userId: string,
    weeks = 4,
    options?: {
      includeLiveGitHub?: boolean;
    }
  ): Promise<ServiceResult<AnalyticsReportBundle>> {
    const safeWeeks = Math.max(1, weeks);
    const now = new Date();
    const since = startOfUtcWeek(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
    since.setUTCDate(since.getUTCDate() - (safeWeeks - 1) * 7);

    const [appUsers, cards, repositories, persistedActivities] = await Promise.all([
      prisma.appUser.findMany({
        orderBy: {
          createdAt: "asc"
        }
      }),
      prisma.card.findMany({
        include: {
          board: {
            select: {
              name: true,
              importedByAppUserId: true
            }
          },
          statusEvents: true,
          comments: true,
          githubActivityLinks: {
            include: {
              activity: {
                include: {
                  repository: true
                }
              }
            }
          },
          developmentLinks: true
        }
      }),
      prisma.gitHubRepository.findMany({
        where: {
          githubInstallation: {
            OR: [
              { appUserId: userId },
              {
                members: {
                  some: {
                    appUserId: userId
                  }
                }
              }
            ]
          }
        },
        include: {
          githubInstallation: true
        }
      }),
      prisma.gitHubActivity.findMany({
        where: {
          authoredAt: {
            gte: since
          }
        },
        include: {
          repository: true,
          taskLinks: true
        }
      })
    ]);

    const linkMaps = buildLinkMaps(cards);
    const liveActivities = options?.includeLiveGitHub
      ? await loadRecentGitHubActivities(repositories, githubService, since, linkMaps)
      : [];
    const fallbackActivities: Awaited<ReturnType<typeof loadRepositoryActivities>> = persistedActivities.map((activity) => {
      if (activity.activityType === "pull_request") {
        return {
          id:
            activity.pullRequestNumber != null
              ? `pull_request:${activity.repositoryId}:${activity.pullRequestNumber}`
              : activity.id,
          type: "pull_request" as const,
          repoId: activity.repositoryId,
          repoName: activity.repository.name,
          repoFullName: activity.repository.fullName,
          title: activity.title,
          authoredAt: activity.authoredAt,
          authorName: activity.authorName,
          authorLogin: activity.authorLogin ?? undefined,
          linkedCardIds: activity.taskLinks.map((taskLink) => taskLink.cardId),
          additions: 0,
          deletions: 0,
          mergedAt: activity.state === "merged" ? activity.updatedAt : null,
          state: activity.state ?? undefined,
          isMergeCommit: false as const,
          isBot: activity.authorLogin?.endsWith("[bot]") ?? false
        };
      }

      return {
        id: activity.sha ? `commit:${activity.repositoryId}:${activity.sha}` : activity.id,
        type: "commit" as const,
        repoId: activity.repositoryId,
        repoName: activity.repository.name,
        repoFullName: activity.repository.fullName,
        title: activity.title,
        authoredAt: activity.authoredAt,
        authorName: activity.authorName,
        authorLogin: activity.authorLogin ?? undefined,
        linkedCardIds: activity.taskLinks.map((taskLink) => taskLink.cardId),
        additions: 0,
        deletions: 0,
        isMergeCommit: isLikelyMergeTitle(activity.title),
        isBot: activity.authorLogin?.endsWith("[bot]") ?? false
      };
    });
    const activities = mergeActivities(liveActivities, fallbackActivities);

    const bundle = buildAnalyticsReportBundle({
      now,
      weeks: safeWeeks,
      appUsers,
      cards: cards.map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description,
        tags: card.tags,
        statusKey: card.statusKey,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        boardName: card.board.name,
        importedByAppUserId: card.board.importedByAppUserId,
        assigneeAppUserId: card.assigneeAppUserId,
        linkedActivityIds: [
          ...card.githubActivityLinks.map((entry) => entry.activityId),
          ...card.developmentLinks.map((link) => link.id)
        ],
        statusEvents: card.statusEvents.map((event) => ({
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          changedAt: event.changedAt
        })),
        comments: card.comments.map((comment) => ({
          authorAppUserId: comment.authorAppUserId,
          authorName: comment.authorName,
          createdAt: comment.createdAt
        }))
      })),
      activities
    });

    return {
      data: bundle,
      source: "database"
    };
  }

  return {
    getSnapshot,
    getReportBundle
  };
}

function startOfUtcWeek(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function buildLinkMaps(cards: Array<{
  id: string;
  githubActivityLinks: Array<{ activity: { sha: string | null; pullRequestNumber: number | null; repositoryId: string } }>;
  developmentLinks: Array<{ sha: string | null }>;
}>) {
  const commitLinks = new Map<string, Set<string>>();
  const pullRequestLinks = new Map<string, Set<string>>();

  for (const card of cards) {
    for (const link of card.githubActivityLinks) {
      if (link.activity.sha) {
        addMapSet(commitLinks, link.activity.sha, card.id);
      }
      if (link.activity.pullRequestNumber != null) {
        addMapSet(pullRequestLinks, `${link.activity.repositoryId}:${link.activity.pullRequestNumber}`, card.id);
      }
    }
    for (const legacyLink of card.developmentLinks) {
      if (legacyLink.sha) {
        addMapSet(commitLinks, legacyLink.sha, card.id);
      }
    }
  }

  return { commitLinks, pullRequestLinks };
}

function addMapSet(map: Map<string, Set<string>>, key: string, value: string) {
  const current = map.get(key) ?? new Set<string>();
  current.add(value);
  map.set(key, current);
}

async function loadRecentGitHubActivities(
  repositories: Array<{
    id: string;
    name: string;
    fullName: string;
    githubInstallation: { githubInstallationId: bigint };
  }>,
  githubService: GitHubService,
  since: Date,
  linkMaps: ReturnType<typeof buildLinkMaps>
) {
  const results: Array<Awaited<ReturnType<typeof loadRepositoryActivities>>> = [];

  for (const repository of repositories) {
    const [owner, repo] = repository.fullName.split("/");
    if (!owner || !repo) {
      continue;
    }

    try {
      const octokit = await githubService.getInstallationOctokit(Number(repository.githubInstallation.githubInstallationId));
      results.push(await loadRepositoryActivities(octokit, repository, owner, repo, since, linkMaps));
    } catch {
      // Keep analytics resilient when one repository or installation cannot be queried.
    }
  }

  return results.flat();
}

async function loadRepositoryActivities(
  octokit: Awaited<ReturnType<GitHubService["getInstallationOctokit"]>>,
  repository: { id: string; name: string; fullName: string },
  owner: string,
  repo: string,
  since: Date,
  linkMaps: ReturnType<typeof buildLinkMaps>
) {
  const [commits, pullRequests] = await Promise.all([
    loadRecentCommits(octokit, repository, owner, repo, since, linkMaps.commitLinks),
    loadRecentPullRequests(octokit, repository, owner, repo, since, linkMaps.pullRequestLinks)
  ]);

  return [...commits, ...pullRequests];
}

async function loadRecentCommits(
  octokit: Awaited<ReturnType<GitHubService["getInstallationOctokit"]>>,
  repository: { id: string; name: string; fullName: string },
  owner: string,
  repo: string,
  since: Date,
  commitLinks: Map<string, Set<string>>
) {
  const collected: Array<{
    id: string;
    type: "commit";
    repoId: string;
    repoName: string;
    repoFullName: string;
    title: string;
    authoredAt: Date;
    authorName: string;
    authorLogin?: string;
    linkedCardIds: string[];
    additions: number;
    deletions: number;
    isMergeCommit: boolean;
    isBot: boolean;
  }> = [];

  let page = 1;
  const limit = 100;
  const stopAt = new Date(since);

  while (page <= 3) {
    const response = await octokit.request("GET /repos/{owner}/{repo}/commits", {
      owner,
      repo,
      since: stopAt.toISOString(),
      per_page: limit,
      page
    });

    const batch = response.data;
    if (batch.length === 0) {
      break;
    }

    for (const summary of batch) {
      const sha = summary.sha;
      const detail = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
        owner,
        repo,
        ref: sha
      });

      const commitDate = new Date(
        detail.data.commit.author?.date ?? detail.data.commit.committer?.date ?? new Date().toISOString()
      );
      if (commitDate < since) {
        continue;
      }

      collected.push({
        id: `commit:${repository.id}:${sha}`,
        type: "commit",
        repoId: repository.id,
        repoName: repository.name,
        repoFullName: repository.fullName,
        title: detail.data.commit.message.split("\n")[0] ?? sha,
        authoredAt: commitDate,
        authorName: detail.data.author?.login ?? detail.data.commit.author?.name ?? "Unknown author",
        authorLogin: detail.data.author?.login ?? undefined,
        linkedCardIds: [...(commitLinks.get(sha) ?? new Set<string>())],
        additions: detail.data.stats?.additions ?? 0,
        deletions: detail.data.stats?.deletions ?? 0,
        isMergeCommit: (detail.data.parents?.length ?? 0) > 1 || isLikelyMergeTitle(detail.data.commit.message),
        isBot: detail.data.author?.type === "Bot" || (detail.data.author?.login?.endsWith("[bot]") ?? false)
      });
    }

    if (batch.length < limit) {
      break;
    }
    page += 1;
  }

  return collected;
}

async function loadRecentPullRequests(
  octokit: Awaited<ReturnType<GitHubService["getInstallationOctokit"]>>,
  repository: { id: string; name: string; fullName: string },
  owner: string,
  repo: string,
  since: Date,
  pullRequestLinks: Map<string, Set<string>>
) {
  const collected: Array<{
    id: string;
    type: "pull_request";
    repoId: string;
    repoName: string;
    repoFullName: string;
    title: string;
    authoredAt: Date;
    authorName: string;
    authorLogin?: string;
    linkedCardIds: string[];
    additions: number;
    deletions: number;
    mergedAt?: Date | null;
    state?: string;
    isMergeCommit: false;
    isBot: boolean;
  }> = [];

  let page = 1;
  const limit = 100;

  while (page <= 3) {
    const response = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: limit,
      page
    });
    const batch = response.data.filter((pullRequest) => {
      const createdAt = new Date(pullRequest.created_at);
      const mergedAt = pullRequest.merged_at ? new Date(pullRequest.merged_at) : null;
      return createdAt >= since || (mergedAt && mergedAt >= since);
    });

    for (const pullRequest of batch) {
      const linkKey = `${repository.id}:${pullRequest.number}`;
      collected.push({
        id: `pull_request:${repository.id}:${pullRequest.number}`,
        type: "pull_request",
        repoId: repository.id,
        repoName: repository.name,
        repoFullName: repository.fullName,
        title: pullRequest.title,
        authoredAt: new Date(pullRequest.created_at),
        authorName: pullRequest.user?.login ?? "Unknown author",
        authorLogin: pullRequest.user?.login ?? undefined,
        linkedCardIds: [...(pullRequestLinks.get(linkKey) ?? new Set<string>())],
        additions: 0,
        deletions: 0,
        mergedAt: pullRequest.merged_at ? new Date(pullRequest.merged_at) : null,
        state: pullRequest.merged_at ? "merged" : pullRequest.state,
        isMergeCommit: false,
        isBot: pullRequest.user?.type === "Bot" || (pullRequest.user?.login?.endsWith("[bot]") ?? false)
      });
    }

    if (response.data.length < limit || batch.length === 0) {
      break;
    }
    page += 1;
  }

  return collected;
}

function mergeActivities<T extends { id: string }>(primary: T[], secondary: T[]) {
  const byId = new Map<string, T>();
  for (const item of [...primary, ...secondary]) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((left, right) => {
    const leftTime = "authoredAt" in left && left.authoredAt instanceof Date ? left.authoredAt.getTime() : 0;
    const rightTime = "authoredAt" in right && right.authoredAt instanceof Date ? right.authoredAt.getTime() : 0;
    return rightTime - leftTime;
  });
}

function isLikelyMergeTitle(value: string) {
  return value.trim().toLowerCase().startsWith("merge ");
}
