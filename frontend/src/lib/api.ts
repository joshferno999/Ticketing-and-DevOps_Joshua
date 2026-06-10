import type {
  AnalyticsSnapshot,
  AppSessionUser,
  AsanaParentTaskSearchResult,
  BoardCard,
  BoardSummary,
  CardComment,
  CreateCardCommentInput,
  CommitTaskLinksResponse,
  GitHubInstallationSummary,
  MoveBoardCardInput,
  OnboardingState,
  PullRequestTaskLinksResponse,
  RepositoryCommitGraphResponse,
  RepositoryCommitNode,
  RepositoryCommitSearchResponse,
  RepositoryPullRequestListResponse,
  TaskSearchResult,
  UpdateBoardCardAssigneeInput,
  UpdateBoardCardDueDateInput,
  UpdateBoardCardManualCompletionInput,
  WorkspaceCapabilities,
  WorkspaceUserSummary
} from "@emergence-devops/shared";
import { parseOnboardingState } from "@emergence-devops/shared";
import { authClient } from "../auth/client";
import { clearOnboardingAppAccess } from "./onboarding-access";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_BASE_URL environment variable is not configured. " +
    "Please set it in frontend/.env (e.g., VITE_API_BASE_URL=http://localhost:4000)"
  );
}

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let handlingUnauthorized = false;

async function handleUnauthorized() {
  if (handlingUnauthorized || typeof window === "undefined") {
    return;
  }

  handlingUnauthorized = true;

  try {
    await authClient.signOut();
  } catch {
    // Ignore sign-out cleanup failures and still force the user back to sign-in.
  } finally {
    clearOnboardingAppAccess();
    window.location.assign("/sign-in");
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message ?? `Request failed with status ${response.status}`;
    if (response.status === 401 && isAppSessionUnauthorized(message)) {
      await handleUnauthorized();
      throw new ApiError("Your session expired. Sign in again.", 401);
    }

    throw new ApiError(message, response.status);
  }

  return (payload?.data ?? payload) as T;
}

function isAppSessionUnauthorized(message: string) {
  return message.includes("Missing or invalid app session") || message.includes("Your session expired");
}

export interface IntegrationStatusPayload {
  auth: {
    connected: boolean;
    user?: AppSessionUser;
  };
  capabilities: WorkspaceCapabilities;
  github: {
    connected: boolean;
    installations: Array<GitHubInstallationSummary & {
      githubInstallationId: string;
    }>;
  };
  asana: {
    connected: boolean;
    workspaceName?: string;
  };
}

export interface AsanaWorkspaceOption {
  gid: string;
  name: string;
}

export interface AsanaProjectOption {
  gid: string;
  name: string;
}

export const api = {
  async getBoards(): Promise<BoardSummary[]> {
    return requestJson("/boards");
  },
  async searchBoardTasks(query: string): Promise<TaskSearchResult> {
    const params = new URLSearchParams();
    params.set("q", query);
    return requestJson(`/boards/tasks/search?${params.toString()}`);
  },
  async createBoardFromParentTask(parentTaskGid: string): Promise<BoardSummary> {
    return requestJson("/boards", {
      method: "POST",
      body: JSON.stringify({ parentTaskGid })
    });
  },
  async starBoard(boardId: string): Promise<BoardSummary> {
    return requestJson(`/boards/${boardId}/star`, {
      method: "POST",
      body: JSON.stringify({})
    });
  },
  async syncBoard(boardId: string): Promise<BoardSummary> {
    return requestJson(`/boards/${boardId}/sync`, {
      method: "POST",
      body: JSON.stringify({})
    });
  },
  async createBoardCard(boardId: string, input: { title: string; description?: string; parentTaskGid?: string }): Promise<BoardCard> {
    return requestJson(`/boards/${boardId}/cards`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async moveBoardCard(boardId: string, cardId: string, input: MoveBoardCardInput): Promise<BoardCard> {
    return requestJson(`/boards/${boardId}/cards/${cardId}/move`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async updateBoardCardDueDate(boardId: string, cardId: string, input: UpdateBoardCardDueDateInput): Promise<BoardCard> {
    return requestJson(`/boards/${boardId}/cards/${cardId}/due-date`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async listWorkspaceUsers(): Promise<WorkspaceUserSummary[]> {
    return requestJson("/workspace/users");
  },
  async updateBoardCardAssignee(boardId: string, cardId: string, input: UpdateBoardCardAssigneeInput): Promise<BoardCard> {
    return requestJson(`/boards/${boardId}/cards/${cardId}/assignee`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async updateBoardCardManualCompletion(
    boardId: string,
    cardId: string,
    input: UpdateBoardCardManualCompletionInput
  ): Promise<BoardCard> {
    return requestJson(`/boards/${boardId}/cards/${cardId}/manual-completion`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async listCardComments(boardId: string, cardId: string): Promise<CardComment[]> {
    return requestJson(`/boards/${boardId}/cards/${cardId}/comments`);
  },
  async createCardComment(
    boardId: string,
    cardId: string,
    input: CreateCardCommentInput
  ): Promise<CardComment> {
    return requestJson(`/boards/${boardId}/cards/${cardId}/comments`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async searchAsanaParentTasks(query: string): Promise<AsanaParentTaskSearchResult[]> {
    const params = new URLSearchParams({ q: query });
    return requestJson(`/integrations/asana/tasks/search?${params.toString()}`);
  },
  async getAsanaWorkspaces(): Promise<AsanaWorkspaceOption[]> {
    return requestJson("/integrations/asana/workspaces");
  },
  async getAsanaProjects(workspaceGid: string): Promise<AsanaProjectOption[]> {
    return requestJson(`/integrations/asana/projects/${workspaceGid}`);
  },
  async getAnalytics(): Promise<AnalyticsSnapshot> {
    return requestJson("/analytics/snapshot");
  },
  async getOnboarding(): Promise<OnboardingState> {
    const payload = await requestJson<unknown>("/onboarding/status");
    const parsed = parseOnboardingState(payload);
    if (!parsed) {
      throw new ApiError("Onboarding status response was invalid.");
    }

    return parsed;
  },
  async getIntegrationStatus(): Promise<IntegrationStatusPayload> {
    return requestJson("/integrations/status");
  },
  async syncAsanaProfile(): Promise<{ user: AppSessionUser }> {
    return requestJson("/integrations/asana/profile/sync", {
      method: "POST",
      body: JSON.stringify({})
    });
  },
  async getAsanaAuthorizeUrl(returnTo?: string): Promise<string | null> {
    const params = new URLSearchParams();
    if (returnTo) {
      params.set("returnTo", returnTo);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/integrations/asana/authorize${params.size > 0 ? `?${params.toString()}` : ""}`, {
        credentials: "include"
      });
      if (!response.ok) {
        if (response.status === 401) {
          await handleUnauthorized();
          throw new ApiError("Your session expired. Sign in again before connecting Asana.", 401);
        }
        return null;
      }
      const payload = await response.json();
      return payload.url ?? null;
    } catch {
      return null;
    }
  },
  async getGitHubInstallUrl(returnTo?: string): Promise<{
    url: string;
    setupCallbackUrl?: string;
    existingInstallations?: GitHubInstallationSummary[];
    canLinkWorkspaceInstallations?: boolean;
  } | null> {
    const params = new URLSearchParams();
    if (returnTo) {
      params.set("returnTo", returnTo);
    }

    const response = await fetch(`${API_BASE_URL}/integrations/github/install-url${params.size > 0 ? `?${params.toString()}` : ""}`, {
      credentials: "include"
    });

    if (!response.ok) {
      if (response.status === 401) {
        await handleUnauthorized();
        throw new ApiError("Your session expired. Sign in again before installing the GitHub App.", 401);
      }

      throw new ApiError("GitHub App install link could not be created.", response.status);
    }

    const payload = await response.json();
    if (typeof payload.url !== "string") {
      return null;
    }

    return {
      url: payload.url,
      setupCallbackUrl: typeof payload.setupCallbackUrl === "string" ? payload.setupCallbackUrl : undefined,
      existingInstallations: Array.isArray(payload.existingInstallations) ? payload.existingInstallations : undefined,
      canLinkWorkspaceInstallations: Boolean(payload.canLinkWorkspaceInstallations)
    };
  },
  async syncGitHubInstallations(): Promise<{
    synced: number;
    source?: "github" | "workspace";
    repositoryCount?: number;
  }> {
    return requestJson("/integrations/github/sync", {
      method: "POST",
      body: JSON.stringify({})
    });
  },
  async getRepositoryCommitGraph(
    repositoryId: string,
    input?: {
      scope?: "all" | "branch";
      branch?: string;
      offset?: number;
      limit?: number;
    }
  ): Promise<RepositoryCommitGraphResponse> {
    const params = new URLSearchParams();
    if (input?.scope) {
      params.set("scope", input.scope);
    }
    if (input?.branch) {
      params.set("branch", input.branch);
    }
    if (typeof input?.offset === "number") {
      params.set("offset", String(input.offset));
    }
    if (typeof input?.limit === "number") {
      params.set("limit", String(input.limit));
    }

    return requestJson(`/repositories/${repositoryId}/commit-graph${params.size > 0 ? `?${params.toString()}` : ""}`);
  },
  async getRepositoryPullRequests(
    repositoryId: string,
    input?: {
      offset?: number;
      limit?: number;
    }
  ): Promise<RepositoryPullRequestListResponse> {
    const params = new URLSearchParams();
    if (typeof input?.offset === "number") {
      params.set("offset", String(input.offset));
    }
    if (typeof input?.limit === "number") {
      params.set("limit", String(input.limit));
    }

    return requestJson(`/repositories/${repositoryId}/pull-requests${params.size > 0 ? `?${params.toString()}` : ""}`);
  },
  async searchRepositoryTasks(repositoryId: string, query: string): Promise<TaskSearchResult> {
    const params = new URLSearchParams();
    params.set("q", query);
    return requestJson(`/repositories/${repositoryId}/tasks/search?${params.toString()}`);
  },
  async searchRepositoryCommits(repositoryId: string, query: string): Promise<RepositoryCommitSearchResponse> {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("limit", "7");
    return requestJson(`/repositories/${repositoryId}/commits/search?${params.toString()}`);
  },
  async getRepositoryCommit(repositoryId: string, sha: string): Promise<RepositoryCommitNode> {
    return requestJson(`/repositories/${repositoryId}/commits/${encodeURIComponent(sha)}`);
  },
  async getCommitTaskLinks(repositoryId: string, sha: string): Promise<CommitTaskLinksResponse> {
    return requestJson(`/repositories/${repositoryId}/commits/${encodeURIComponent(sha)}/task-links`);
  },
  async saveCommitTaskLinks(repositoryId: string, sha: string, cardIds: string[]): Promise<CommitTaskLinksResponse> {
    return requestJson(`/repositories/${repositoryId}/commits/${encodeURIComponent(sha)}/task-links`, {
      method: "PUT",
      body: JSON.stringify({ cardIds })
    });
  },
  async getPullRequestTaskLinks(repositoryId: string, pullRequestNumber: number): Promise<PullRequestTaskLinksResponse> {
    return requestJson(`/repositories/${repositoryId}/pull-requests/${pullRequestNumber}/task-links`);
  },
  async savePullRequestTaskLinks(
    repositoryId: string,
    pullRequestNumber: number,
    cardIds: string[]
  ): Promise<PullRequestTaskLinksResponse> {
    return requestJson(`/repositories/${repositoryId}/pull-requests/${pullRequestNumber}/task-links`, {
      method: "PUT",
      body: JSON.stringify({ cardIds })
    });
  }
};
