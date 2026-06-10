import type { PrismaClient } from "@prisma/client";
import type { ServiceResult } from "../../lib/result";
import { mapInstallationRecord } from "../github/github.installation.service";

export function createOnboardingService(prisma: PrismaClient) {
  async function getStatus(userId: string): Promise<ServiceResult<{
    accountConnected: boolean;
    displayName?: string;
    avatarUrl?: string;
    githubInstalled: boolean;
    asanaConnected: boolean;
    boardMapped: boolean;
    columnsMapped: boolean;
    githubInstallations: Array<{
      id: string;
      accountLogin: string;
      accountType: string;
      targetType: string;
      repositorySelection: "all" | "selected";
      repositoryCount: number;
      settingsUrl?: string;
      repositories: Array<{
        id: string;
        name: string;
        fullName: string;
      }>;
    }>;
    githubRepositoryCount: number;
  }>> {
    const appUser = await prisma.appUser.findUnique({
      where: {
        id: userId
      }
    });

    const workspaceInstallations = await prisma.gitHubInstallation.findMany({
      include: {
        repositories: {
          orderBy: {
            fullName: "asc"
          }
        }
      },
      orderBy: {
        accountLogin: "asc"
      }
    });

    const workspaceBoards = await prisma.board.findMany({
      include: {
        boardColumnMappings: true
      }
    });

    if (!appUser) {
      return {
        data: {
          accountConnected: false,
          githubInstalled: false,
          asanaConnected: false,
          boardMapped: false,
          columnsMapped: false,
          githubInstallations: [],
          githubRepositoryCount: 0
        },
        source: "database"
      };
    }

    const githubInstallations = workspaceInstallations.map(mapInstallationRecord);
    const githubInstalled = githubInstallations.length > 0;
    const asanaConnected = Boolean(appUser.asanaAccessTokenEncrypted);
    const boardMapped = workspaceBoards.length > 0;
    const columnsMapped = workspaceBoards.some((board) => board.boardColumnMappings.length > 0);
    const githubRepositoryCount = githubInstallations.reduce((sum, installation) => sum + installation.repositories.length, 0);

    return {
      data: {
        accountConnected: true,
        displayName: appUser.displayName ?? undefined,
        avatarUrl: appUser.asanaProfileImageUrl ?? undefined,
        githubInstalled,
        asanaConnected,
        boardMapped,
        columnsMapped,
        githubInstallations,
        githubRepositoryCount
      },
      source: "database"
    };
  }

  return {
    getStatus
  };
}
