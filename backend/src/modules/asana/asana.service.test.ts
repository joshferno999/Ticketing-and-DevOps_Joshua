import { describe, expect, it, vi, afterEach } from "vitest";
import { encryptValue } from "../../lib/crypto";
import { createAsanaService } from "./asana.service";

const env = {
  APP_AUTH_SECRET: "test-secret",
  ASANA_CLIENT_ID: "asana-client",
  ASANA_CLIENT_SECRET: "asana-secret",
  ASANA_REDIRECT_URI: "http://localhost:4000/api/integrations/asana/callback"
};

describe("createAsanaService syncUserIdentity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("persists display name, gid, and avatar from Asana identity endpoints", async () => {
    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user_1",
          asanaAccessTokenEncrypted: encryptValue("access-token", env.APP_AUTH_SECRET),
          asanaRefreshTokenEncrypted: encryptValue("refresh-token", env.APP_AUTH_SECRET),
          asanaTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
        }),
        update: vi.fn().mockResolvedValue({
          asanaUserGid: "12001",
          displayName: "Hari Sync",
          asanaProfileImageUrl: "https://cdn.asana.com/avatar.png"
        })
      }
    } as any;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        name: "Hari Sync",
        picture: "https://cdn.asana.com/avatar.png"
      })
    }));

    const asanaClientFactory = {
      fromAccessToken: vi.fn().mockReturnValue({
        users: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              gid: "12001",
              name: "Hari From Me"
            }
          })
        }
      })
    } as any;

    const service = createAsanaService(prisma, env);
    const identity = await service.syncUserIdentity("user_1", asanaClientFactory);

    expect(asanaClientFactory.fromAccessToken).toHaveBeenCalledWith("access-token");
    expect(prisma.appUser.update).toHaveBeenCalledWith({
      where: {
        id: "user_1"
      },
      data: {
        displayName: "Hari Sync",
        asanaUserGid: "12001",
        asanaProfileImageUrl: "https://cdn.asana.com/avatar.png"
      }
    });
    expect(identity).toEqual({
      asanaUserGid: "12001",
      displayName: "Hari Sync",
      avatarUrl: "https://cdn.asana.com/avatar.png"
    });
  });

  it("clears the avatar when Asana user info does not include a profile image", async () => {
    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user_2",
          asanaAccessTokenEncrypted: encryptValue("access-token", env.APP_AUTH_SECRET),
          asanaRefreshTokenEncrypted: encryptValue("refresh-token", env.APP_AUTH_SECRET),
          asanaTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
        }),
        update: vi.fn().mockResolvedValue({
          asanaUserGid: "12002",
          displayName: "Fallback Name",
          asanaProfileImageUrl: null
        })
      }
    } as any;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    }));

    const asanaClientFactory = {
      fromAccessToken: vi.fn().mockReturnValue({
        users: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              gid: "12002",
              name: "Fallback Name"
            }
          })
        }
      })
    } as any;

    const service = createAsanaService(prisma, env);
    const identity = await service.syncUserIdentity("user_2", asanaClientFactory);

    expect(prisma.appUser.update).toHaveBeenCalledWith({
      where: {
        id: "user_2"
      },
      data: {
        displayName: "Fallback Name",
        asanaUserGid: "12002",
        asanaProfileImageUrl: null
      }
    });
    expect(identity).toEqual({
      asanaUserGid: "12002",
      displayName: "Fallback Name",
      avatarUrl: undefined
    });
  });

  it("preserves the existing display name when Asana returns no name", async () => {
    const prisma = {
      appUser: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user_3",
          asanaAccessTokenEncrypted: encryptValue("access-token", env.APP_AUTH_SECRET),
          asanaRefreshTokenEncrypted: encryptValue("refresh-token", env.APP_AUTH_SECRET),
          asanaTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
        }),
        update: vi.fn().mockResolvedValue({
          asanaUserGid: "12003",
          displayName: "Existing Name",
          asanaProfileImageUrl: null
        })
      }
    } as any;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    }));

    const asanaClientFactory = {
      fromAccessToken: vi.fn().mockReturnValue({
        users: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              gid: "12003"
            }
          })
        }
      })
    } as any;

    const service = createAsanaService(prisma, env);
    const identity = await service.syncUserIdentity("user_3", asanaClientFactory);

    expect(prisma.appUser.update).toHaveBeenCalledWith({
      where: {
        id: "user_3"
      },
      data: {
        asanaUserGid: "12003",
        asanaProfileImageUrl: null
      }
    });
    expect(identity).toEqual({
      asanaUserGid: "12003",
      displayName: "Existing Name",
      avatarUrl: undefined
    });
  });
});
