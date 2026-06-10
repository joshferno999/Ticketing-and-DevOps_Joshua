import { primaryAsanaTaskId } from "@emergence-devops/shared";
import type { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

export function createGitHubWebhookService(prisma: PrismaClient) {
  async function persistDelivery(event: string, payload: unknown, deliveryId?: string) {
    return prisma.webhookDelivery.create({
      data: {
        provider: "github",
        eventName: event,
        deliveryId: deliveryId ?? crypto.randomUUID(),
        rawPayload: payload as object,
        status: "received"
      }
    });
  }

  async function processPush(payload: any) {
    const commits = Array.isArray(payload.commits) ? payload.commits : [];
    const jobs = commits
      .map((commit: any) => {
        const taskId = primaryAsanaTaskId(commit.message ?? "");
        if (!taskId) {
          return null;
        }

        return prisma.syncJob.create({
          data: {
            provider: "github",
            jobType: "commit_link",
            payload: {
              taskId,
              commit
            }
          }
        });
      })
      .filter(Boolean);

    await Promise.all(jobs as Promise<unknown>[]);
  }

  async function processBranchCreated(payload: any) {
    const taskId = primaryAsanaTaskId(payload.ref ?? "");
    if (!taskId) {
      return;
    }

    await prisma.syncJob.create({
      data: {
        provider: "github",
        jobType: "branch_link",
        payload: {
          taskId,
          branch: payload.ref
        }
      }
    });
  }

  async function processPullRequest(payload: any) {
    const title = payload.pull_request?.title ?? "";
    const body = payload.pull_request?.body ?? "";
    const taskId = primaryAsanaTaskId(`${title}\n${body}`);
    if (!taskId) {
      return;
    }

    await prisma.syncJob.create({
      data: {
        provider: "github",
        jobType: "pull_request_link",
        payload: {
          taskId,
          action: payload.action,
          pullRequest: payload.pull_request
        }
      }
    });
  }

  return {
    persistDelivery,
    processPush,
    processBranchCreated,
    processPullRequest
  };
}
