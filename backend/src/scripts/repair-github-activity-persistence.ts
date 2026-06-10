import "dotenv/config";
import process from "node:process";
import { prisma } from "../db/prisma";
import { repairGitHubActivityPersistence } from "../modules/github/github-activity-repair";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stats = await repairGitHubActivityPersistence(prisma, {
    repositoryId: args.repositoryId,
    sha: args.sha,
    pullRequestNumber: args.pullRequestNumber
  });

  console.log(JSON.stringify({
    repositoryId: args.repositoryId ?? null,
    sha: args.sha ?? null,
    pullRequestNumber: args.pullRequestNumber ?? null,
    stats
  }, null, 2));
}

function parseArgs(args: string[]) {
  const parsed: {
    repositoryId?: string;
    sha?: string;
    pullRequestNumber?: number;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === "--repository-id") {
      parsed.repositoryId = args[index + 1];
      index += 1;
    } else if (current === "--sha") {
      parsed.sha = args[index + 1];
      index += 1;
    } else if (current === "--pull-request-number") {
      parsed.pullRequestNumber = Number(args[index + 1]);
      index += 1;
    }
  }

  return parsed;
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
