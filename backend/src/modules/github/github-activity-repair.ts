import type { PrismaClient } from "@prisma/client";

type RepairLogger = (details: Record<string, unknown>, message: string) => void;

type RepairOptions = {
  repositoryId?: string;
  sha?: string;
  pullRequestNumber?: number;
  logger?: RepairLogger;
};

type RepairStats = {
  scanned: number;
  updated: number;
  created: number;
  deleted: number;
  linkedTaskRowsCopied: number;
};

const defaultLogger: RepairLogger = (details, message) => {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.warn(`[github-activity-repair] ${message}`, details);
};

export async function repairGitHubActivityPersistence(prisma: PrismaClient, options: RepairOptions = {}): Promise<RepairStats> {
  const logger = options.logger ?? defaultLogger;
  const runRepair = async (tx: any) => {
    const activities = await tx.gitHubActivity.findMany({
      where: {
        ...(options.repositoryId ? { repositoryId: options.repositoryId } : {}),
        ...((options.sha || options.pullRequestNumber != null)
          ? {
              OR: [
                ...(options.sha ? [{ sha: options.sha }] : []),
                ...(options.pullRequestNumber != null ? [{ pullRequestNumber: options.pullRequestNumber }] : [])
              ]
            }
          : {})
      },
      include: {
        taskLinks: {
          select: {
            cardId: true
          }
        }
      },
      orderBy: [
        { createdAt: "asc" },
        { id: "asc" }
      ]
    });

    const stats: RepairStats = {
      scanned: activities.length,
      updated: 0,
      created: 0,
      deleted: 0,
      linkedTaskRowsCopied: 0
    };

    for (const activity of activities) {
      const cardIds = activity.taskLinks.map((taskLink: { cardId: string }) => taskLink.cardId);

      if (!activity.sha && activity.pullRequestNumber == null) {
        logger(
          {
            activityId: activity.id,
            repositoryId: activity.repositoryId,
            activityType: activity.activityType,
            linkedTaskCount: cardIds.length
          },
          "Found GitHub activity row without commit sha or pull request number."
        );

        if (cardIds.length === 0) {
          await tx.gitHubActivity.delete({
            where: {
              id: activity.id
            }
          });
          stats.deleted += 1;
        }

        continue;
      }

      if (activity.sha && activity.pullRequestNumber != null) {
        logger(
          {
            activityId: activity.id,
            repositoryId: activity.repositoryId,
            sha: activity.sha,
            pullRequestNumber: activity.pullRequestNumber,
            activityType: activity.activityType
          },
          "Found GitHub activity row carrying both commit and pull request identities; splitting into canonical rows."
        );

        if (activity.activityType === "pull_request") {
          const commitActivity = await tx.gitHubActivity.upsert({
            where: {
              repositoryId_sha: {
                repositoryId: activity.repositoryId,
                sha: activity.sha
              }
            },
            update: {
              activityType: "commit",
              title: activity.title,
              url: activity.url,
              state: activity.state,
              branchName: activity.branchName,
              authorName: activity.authorName,
              authorLogin: activity.authorLogin,
              authoredAt: activity.authoredAt
            },
            create: {
              repositoryId: activity.repositoryId,
              activityType: "commit",
              title: activity.title,
              url: activity.url,
              state: activity.state,
              sha: activity.sha,
              branchName: activity.branchName,
              authorName: activity.authorName,
              authorLogin: activity.authorLogin,
              authoredAt: activity.authoredAt
            }
          });

          const copied = await copyTaskLinks(tx, commitActivity.id, cardIds);
          stats.created += commitActivity.id === activity.id ? 0 : 1;
          stats.linkedTaskRowsCopied += copied;

          await tx.gitHubActivity.update({
            where: {
              id: activity.id
            },
            data: {
              sha: null,
              activityType: "pull_request"
            }
          });
          stats.updated += 1;
          continue;
        }

        const pullRequestActivity = await tx.gitHubActivity.upsert({
          where: {
            repositoryId_pullRequestNumber: {
              repositoryId: activity.repositoryId,
              pullRequestNumber: activity.pullRequestNumber
            }
          },
          update: {
            activityType: "pull_request",
            title: activity.title,
            url: activity.url,
            state: activity.state,
            branchName: activity.branchName,
            authorName: activity.authorName,
            authorLogin: activity.authorLogin,
            authoredAt: activity.authoredAt
          },
          create: {
            repositoryId: activity.repositoryId,
            activityType: "pull_request",
            title: activity.title,
            url: activity.url,
            state: activity.state,
            pullRequestNumber: activity.pullRequestNumber,
            branchName: activity.branchName,
            authorName: activity.authorName,
            authorLogin: activity.authorLogin,
            authoredAt: activity.authoredAt
          }
        });

        const copied = await copyTaskLinks(tx, pullRequestActivity.id, cardIds);
        stats.created += pullRequestActivity.id === activity.id ? 0 : 1;
        stats.linkedTaskRowsCopied += copied;

        await tx.gitHubActivity.update({
          where: {
            id: activity.id
          },
          data: {
            pullRequestNumber: null,
            activityType: "commit"
          }
        });
        stats.updated += 1;
        continue;
      }

      if (activity.sha && activity.activityType !== "commit") {
        logger(
          {
            activityId: activity.id,
            repositoryId: activity.repositoryId,
            sha: activity.sha,
            activityType: activity.activityType
          },
          "Normalizing GitHub activity row to commit identity."
        );

        await tx.gitHubActivity.update({
          where: {
            id: activity.id
          },
          data: {
            activityType: "commit"
          }
        });
        stats.updated += 1;
        continue;
      }

      if (activity.pullRequestNumber != null && activity.activityType !== "pull_request") {
        logger(
          {
            activityId: activity.id,
            repositoryId: activity.repositoryId,
            pullRequestNumber: activity.pullRequestNumber,
            activityType: activity.activityType
          },
          "Normalizing GitHub activity row to pull request identity."
        );

        await tx.gitHubActivity.update({
          where: {
            id: activity.id
          },
          data: {
            activityType: "pull_request"
          }
        });
        stats.updated += 1;
      }
    }

    return stats;
  };

  if (typeof prisma.$transaction === "function") {
    return prisma.$transaction((tx) => runRepair(tx));
  }

  return runRepair(prisma as any);
}

async function copyTaskLinks(tx: any, activityId: string, cardIds: string[]) {
  const uniqueCardIds = [...new Set(cardIds)];
  if (uniqueCardIds.length === 0) {
    return 0;
  }

  const result = await tx.gitHubActivityTaskLink.createMany({
    data: uniqueCardIds.map((cardId) => ({
      activityId,
      cardId
    })),
    skipDuplicates: true
  });

  return result.count;
}
