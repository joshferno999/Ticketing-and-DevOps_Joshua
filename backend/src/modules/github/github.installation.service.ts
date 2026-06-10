import type { GitHubInstallation, GitHubRepository, PrismaClient } from "@prisma/client";
import type { createGitHubService } from "./github.service";

export type InstallationPayload = {
  installationId: number;
  accountLogin: string;
  accountType: string;
  targetType: string;
  repositorySelection: "all" | "selected";
  settingsUrl?: string;
  repositories: Array<{
    id: number;
    name: string;
    full_name: string;
  }>;
};

type InstallationWithRepositories = GitHubInstallation & {
  repositories: GitHubRepository[];
};

const installationInclude = {
  repositories: {
    orderBy: {
      fullName: "asc" as const
    }
  }
};

type GitHubInstallationDetails = Awaited<
  ReturnType<NonNullable<ReturnType<typeof createGitHubService>>["getInstallationDetails"]>
>;

function resolveInstallationAccountLogin(
  account: GitHubInstallationDetails["installation"]["account"]
): string {
  if (!account) {
    return "unknown";
  }

  if ("login" in account && typeof account.login === "string" && account.login.length > 0) {
    return account.login;
  }

  if ("slug" in account && typeof account.slug === "string" && account.slug.length > 0) {
    return account.slug;
  }

  if ("name" in account && typeof account.name === "string" && account.name.length > 0) {
    return account.name;
  }

  return "unknown";
}

function resolveInstallationAccountType(
  account: GitHubInstallationDetails["installation"]["account"]
): string {
  if (!account) {
    return "Organization";
  }

  if ("type" in account && typeof account.type === "string" && account.type.length > 0) {
    return account.type;
  }

  if ("slug" in account) {
    return "Organization";
  }

  return "User";
}

export function buildInstallationPayloadFromDetails(
  installationId: number,
  details: GitHubInstallationDetails
): InstallationPayload {
  const account = details.installation.account;
  const accountType = resolveInstallationAccountType(account);

  return {
    installationId,
    accountLogin: resolveInstallationAccountLogin(account),
    accountType,
    targetType: details.installation.target_type ?? accountType,
    repositorySelection: details.installation.repository_selection === "selected" ? "selected" : "all",
    settingsUrl: details.installation.html_url ?? undefined,
    repositories: details.repositories.map((repository) => ({
      id: repository.id,
      name: repository.name,
      full_name: repository.full_name
    }))
  };
}

export function mapInstallationRecord(installation: InstallationWithRepositories) {
  return {
    id: installation.githubInstallationId.toString(),
    githubInstallationId: installation.githubInstallationId.toString(),
    accountLogin: installation.accountLogin,
    accountType: installation.accountType,
    targetType: installation.targetType,
    repositorySelection: installation.repositorySelection === "selected" ? "selected" as const : "all" as const,
    repositoryCount: installation.repositories.length,
    settingsUrl: installation.settingsUrl ?? undefined,
    repositories: installation.repositories.map((repository) => ({
      id: repository.id,
      name: repository.name,
      fullName: repository.fullName
    }))
  };
}

export function createGitHubInstallationService(
  prisma: PrismaClient,
  githubService?: ReturnType<typeof createGitHubService>
) {
  async function linkMember(appUserId: string, githubInstallationDbId: string) {
    await prisma.gitHubInstallationMember.upsert({
      where: {
        appUserId_githubInstallationDbId: {
          appUserId,
          githubInstallationDbId
        }
      },
      update: {},
      create: {
        appUserId,
        githubInstallationDbId
      }
    });

    const installation = await prisma.gitHubInstallation.findUnique({
      where: {
        id: githubInstallationDbId
      }
    });

    if (installation) {
      await prisma.appUser.update({
        where: {
          id: appUserId
        },
        data: {
          githubInstallationId: installation.githubInstallationId,
          githubAccountLogin: installation.accountLogin,
          githubAccountType: installation.accountType
        }
      });
    }
  }

  async function persistInstallation(appUserId: string, payload: InstallationPayload) {
    const installation = await prisma.gitHubInstallation.upsert({
      where: {
        githubInstallationId: BigInt(payload.installationId)
      },
      update: {
        accountLogin: payload.accountLogin,
        accountType: payload.accountType,
        targetType: payload.targetType,
        repositorySelection: payload.repositorySelection,
        settingsUrl: payload.settingsUrl
      },
      create: {
        githubInstallationId: BigInt(payload.installationId),
        appUserId,
        accountLogin: payload.accountLogin,
        accountType: payload.accountType,
        targetType: payload.targetType,
        repositorySelection: payload.repositorySelection,
        settingsUrl: payload.settingsUrl
      }
    });

    await prisma.$transaction(async (tx) => {
      const remoteRepositoryIds = payload.repositories.map((repository) => BigInt(repository.id));
      await tx.gitHubRepository.deleteMany({
        where: {
          githubInstallationDbId: installation.id,
          ...(remoteRepositoryIds.length > 0
            ? {
                githubRepoId: {
                  notIn: remoteRepositoryIds
                }
              }
            : {})
        }
      });

      for (const repository of payload.repositories) {
        await tx.gitHubRepository.upsert({
          where: {
            githubInstallationDbId_githubRepoId: {
              githubInstallationDbId: installation.id,
              githubRepoId: BigInt(repository.id)
            }
          },
          update: {
            name: repository.name,
            fullName: repository.full_name
          },
          create: {
            githubInstallationDbId: installation.id,
            githubRepoId: BigInt(repository.id),
            name: repository.name,
            fullName: repository.full_name
          }
        });
      }
    });

    await linkMember(appUserId, installation.id);

    return prisma.gitHubInstallation.findUniqueOrThrow({
      where: {
        id: installation.id
      },
      include: installationInclude
    });
  }

  async function listWorkspaceInstallations() {
    return prisma.gitHubInstallation.findMany({
      include: installationInclude,
      orderBy: {
        accountLogin: "asc"
      }
    });
  }

  async function userHasGitHubAccess(appUserId: string) {
    const memberCount = await prisma.gitHubInstallationMember.count({
      where: {
        appUserId
      }
    });

    if (memberCount > 0) {
      return true;
    }

    const workspaceCount = await prisma.gitHubInstallation.count();
    return workspaceCount > 0;
  }

  async function linkUserToAllWorkspaceInstallations(appUserId: string) {
    const installations = await listWorkspaceInstallations();
    await Promise.all(installations.map((installation) => linkMember(appUserId, installation.id)));
    return installations;
  }

  async function syncWorkspaceFromGitHub(appUserId: string) {
    if (!githubService) {
      throw new Error("GitHub service is required to sync workspace installations");
    }

    const remoteInstallations = await githubService.listInstallations();
    const synced: InstallationWithRepositories[] = [];

    for (const remoteInstallation of remoteInstallations) {
      const installationId = remoteInstallation.id;
      if (!installationId) {
        continue;
      }

      const details = await githubService.getInstallationDetails(installationId);
      const record = await persistInstallation(
        appUserId,
        buildInstallationPayloadFromDetails(installationId, details)
      );
      synced.push(record);
    }

    return synced;
  }

  async function refreshWorkspaceInstallationsFromGitHub(appUserId: string) {
    if (!githubService) {
      throw new Error("GitHub service is required to refresh workspace installations");
    }

    const installations = await listWorkspaceInstallations();
    const refreshed: InstallationWithRepositories[] = [];

    for (const installation of installations) {
      const installationId = Number(installation.githubInstallationId);
      const details = await githubService.getInstallationDetails(installationId);
      const record = await persistInstallation(
        appUserId,
        buildInstallationPayloadFromDetails(installationId, details)
      );
      refreshed.push(record);
    }

    return refreshed;
  }

  async function refreshInstallationByGithubId(githubInstallationId: number) {
    if (!githubService) {
      throw new Error("GitHub service is required to refresh an installation");
    }

    const installation = await prisma.gitHubInstallation.findUnique({
      where: {
        githubInstallationId: BigInt(githubInstallationId)
      }
    });

    if (!installation) {
      return null;
    }

    const details = await githubService.getInstallationDetails(githubInstallationId);
    return persistInstallation(
      installation.appUserId,
      buildInstallationPayloadFromDetails(githubInstallationId, details)
    );
  }

  return {
    linkMember,
    persistInstallation,
    listWorkspaceInstallations,
    userHasGitHubAccess,
    linkUserToAllWorkspaceInstallations,
    syncWorkspaceFromGitHub,
    refreshWorkspaceInstallationsFromGitHub,
    refreshInstallationByGithubId,
    mapInstallationRecord
  };
}
