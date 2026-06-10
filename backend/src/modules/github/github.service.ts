import { App as GitHubApp } from "@octokit/app";
import crypto from "node:crypto";
import { normalizePrivateKey } from "../../lib/normalize-private-key.js";

interface GitHubEnv {
  APP_AUTH_SECRET: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET?: string;
}

interface GitHubInstallStatePayload {
  appUserId: string;
  sessionId: string;
  returnTo?: string;
  expiresAt: number;
}

export function createGitHubService(env: GitHubEnv) {
  const app = new GitHubApp({
    appId: env.GITHUB_APP_ID,
    privateKey: normalizePrivateKey(env.GITHUB_APP_PRIVATE_KEY)
  });

  function verifyWebhookSignature(rawBody: string, signature?: string) {
    if (!env.GITHUB_WEBHOOK_SECRET) {
      return true;
    }

    if (!signature) {
      return false;
    }

    const expected = `sha256=${crypto
      .createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex")}`;

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  async function getInstallationOctokit(installationId: number) {
    return app.getInstallationOctokit(installationId);
  }

  async function getAppMetadata() {
    const response = await app.octokit.request("GET /app");
    return response.data;
  }

  async function listInstallations() {
    const response = await app.octokit.request("GET /app/installations");
    return response.data;
  }

  function createInstallState(input: {
    appUserId: string;
    sessionId: string;
    returnTo?: string;
  }) {
    const payload: GitHubInstallStatePayload = {
      appUserId: input.appUserId,
      sessionId: input.sessionId,
      returnTo: input.returnTo,
      expiresAt: Date.now() + 1000 * 60 * 15
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", env.APP_AUTH_SECRET)
      .update(encodedPayload)
      .digest("base64url");

    return `${encodedPayload}.${signature}`;
  }

  function verifyInstallState(token?: string | null) {
    if (!token) {
      return null;
    }

    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.APP_AUTH_SECRET)
      .update(encodedPayload)
      .digest("base64url");

    if (signature.length !== expectedSignature.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as GitHubInstallStatePayload;
      if (!payload.appUserId || !payload.sessionId || payload.expiresAt <= Date.now()) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  async function listInstallationRepositories(installationId: number) {
    const octokit = await getInstallationOctokit(installationId);
    const repositories: Array<{
      id: number;
      name: string;
      full_name: string;
    }> = [];
    const perPage = 100;
    let page = 1;

    while (true) {
      const response = await octokit.request("GET /installation/repositories", {
        per_page: perPage,
        page
      });
      const batch = response.data.repositories ?? [];
      repositories.push(...batch);
      if (batch.length < perPage) {
        break;
      }
      page += 1;
    }

    return repositories;
  }

  async function getInstallationDetails(installationId: number) {
    const [installation, repositories] = await Promise.all([
      app.octokit.request("GET /app/installations/{installation_id}", {
        installation_id: installationId
      }),
      listInstallationRepositories(installationId)
    ]);

    return {
      installation: installation.data,
      repositories
    };
  }

  return {
    app,
    verifyWebhookSignature,
    getInstallationOctokit,
    getAppMetadata,
    listInstallations,
    getInstallationDetails,
    createInstallState,
    verifyInstallState
  };
}
