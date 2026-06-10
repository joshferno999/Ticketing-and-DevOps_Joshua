import { describe, expect, it, vi } from "vitest";
import { buildInstallationPayloadFromDetails, createGitHubInstallationService, mapInstallationRecord } from "./github.installation.service";

describe("buildInstallationPayloadFromDetails", () => {
  it("maps installation metadata and repositories", () => {
    const details = {
      installation: {
        account: { login: "emsoft-org", type: "Organization" },
        target_type: "Organization",
        repository_selection: "selected",
        html_url: "https://github.com/organizations/emsoft-org/settings/installations/133467158"
      },
      repositories: [
        { id: 1, name: "app", full_name: "emsoft-org/app" },
        { id: 2, name: "api", full_name: "emsoft-org/api" }
      ]
    } as Parameters<typeof buildInstallationPayloadFromDetails>[1];

    const payload = buildInstallationPayloadFromDetails(133467158, details);

    expect(payload).toMatchObject({
      installationId: 133467158,
      accountLogin: "emsoft-org",
      repositorySelection: "selected",
      repositories: [
        { full_name: "emsoft-org/app" },
        { full_name: "emsoft-org/api" }
      ]
    });
  });
});

describe("mapInstallationRecord", () => {
  it("maps a workspace installation for API responses", () => {
    const mapped = mapInstallationRecord({
      id: "install-db-1",
      githubInstallationId: BigInt(133467158),
      accountLogin: "emsoft-org",
      accountType: "Organization",
      targetType: "Organization",
      repositorySelection: "selected",
      settingsUrl: "https://github.com/organizations/emsoft-org/settings/installations/133467158",
      createdAt: new Date(),
      updatedAt: new Date(),
      appUserId: "user_a",
      repositories: [
        {
          id: "repo-db-1",
          githubRepoId: BigInt(1),
          name: "app",
          fullName: "emsoft-org/app",
          defaultBoardId: null,
          githubInstallationDbId: "install-db-1"
        }
      ]
    });

    expect(mapped).toMatchObject({
      id: "133467158",
      accountLogin: "emsoft-org",
      repositorySelection: "selected",
      repositoryCount: 1,
      repositories: [{ fullName: "emsoft-org/app" }]
    });
  });
});

describe("createGitHubInstallationService", () => {
  it("upserts synced repositories so existing activity links keep their repository id", async () => {
    const installation = {
      id: "install-db-1",
      githubInstallationId: BigInt(133467158),
      accountLogin: "emsoft-org",
      accountType: "Organization"
    };
    const prisma = {
      gitHubInstallation: {
        upsert: vi.fn().mockResolvedValue(installation),
        findUnique: vi.fn().mockResolvedValue(installation),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...installation,
          targetType: "Organization",
          repositorySelection: "selected",
          settingsUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          appUserId: "user_1",
          repositories: []
        })
      },
      gitHubRepository: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue({})
      },
      gitHubInstallationMember: {
        upsert: vi.fn().mockResolvedValue({})
      },
      appUser: {
        update: vi.fn().mockResolvedValue({})
      },
      $transaction: vi.fn(async (callback) => callback(prisma))
    } as any;

    const service = createGitHubInstallationService(prisma);
    await service.persistInstallation("user_1", {
      installationId: 133467158,
      accountLogin: "emsoft-org",
      accountType: "Organization",
      targetType: "Organization",
      repositorySelection: "selected",
      repositories: [
        {
          id: 42,
          name: "app",
          full_name: "emsoft-org/app"
        }
      ]
    });

    expect(prisma.gitHubRepository.deleteMany).toHaveBeenCalledWith({
      where: {
        githubInstallationDbId: "install-db-1",
        githubRepoId: {
          notIn: [BigInt(42)]
        }
      }
    });
    expect(prisma.gitHubRepository.upsert).toHaveBeenCalledWith({
      where: {
        githubInstallationDbId_githubRepoId: {
          githubInstallationDbId: "install-db-1",
          githubRepoId: BigInt(42)
        }
      },
      update: {
        name: "app",
        fullName: "emsoft-org/app"
      },
      create: {
        githubInstallationDbId: "install-db-1",
        githubRepoId: BigInt(42),
        name: "app",
        fullName: "emsoft-org/app"
      }
    });
  });
});
