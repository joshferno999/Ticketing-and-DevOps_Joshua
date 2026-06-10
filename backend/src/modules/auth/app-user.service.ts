import type { AppUser, PrismaClient } from "@prisma/client";
import type { SessionUser } from "./auth.service";

export function createAppUserService(prisma: PrismaClient) {
  async function createUser(input: {
    email: string;
    passwordHash: string;
    displayName?: string;
  }): Promise<AppUser> {
    return prisma.appUser.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        displayName: input.displayName
      }
    });
  }

  async function getByEmail(email: string) {
    return prisma.appUser.findUnique({
      where: {
        email: email.toLowerCase()
      }
    });
  }

  async function getById(id: string) {
    return prisma.appUser.findUnique({
      where: {
        id
      }
    });
  }

  function toSessionUser(appUser: AppUser): SessionUser {
    return {
      id: appUser.id,
      email: appUser.email,
      name: appUser.displayName ?? undefined,
      avatarUrl: appUser.asanaProfileImageUrl ?? undefined
    };
  }

  return {
    createUser,
    getByEmail,
    getById,
    toSessionUser
  };
}
