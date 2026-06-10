import { describe, expect, it } from "vitest";
import type { RepositoryCommitGraphResponse, RepositoryCommitNode } from "@emergence-devops/shared";
import { buildRepositoryGraphModel, COMMIT_GRAPH_ROW_HEIGHT } from "./repository-graph-layout";

function makeCommit(input: Partial<RepositoryCommitNode> & Pick<RepositoryCommitNode, "sha" | "committedAt">): RepositoryCommitNode {
  return {
    shortSha: input.sha.slice(0, 7),
    messageHeadline: input.sha,
    messageBody: "",
    authorName: "Author",
    authoredAt: input.committedAt,
    parentShas: [],
    branchHeadNames: [],
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    htmlUrl: "https://github.com/example/repo/commit/" + input.sha,
    taggedTaskCount: 0,
    taggedTasksPreview: [],
    ...input
  };
}

function makePayload(commits: RepositoryCommitNode[]): RepositoryCommitGraphResponse {
  return {
    repo: {
      id: "repo-1",
      name: "repo",
      fullName: "example/repo",
      defaultBranch: "main",
      htmlUrl: "https://github.com/example/repo"
    },
    branchOptions: [
      {
        name: "main",
        headSha: commits[0]?.sha ?? "head",
        isDefault: true,
        isIncludedInCurrentScope: true
      }
    ],
    commits,
    pageInfo: {
      offset: 0,
      limit: commits.length,
      hasMore: false,
      nextOffset: null,
      totalCommits: commits.length
    }
  };
}

describe("buildRepositoryGraphModel", () => {
  it("preserves newest-first commit order in timeline rows", () => {
    const commits = [
      makeCommit({ sha: "head000", committedAt: "2026-05-18T11:00:00Z", parentShas: ["base000"], branchHeadNames: ["main"] }),
      makeCommit({ sha: "base000", committedAt: "2026-05-18T10:00:00Z", parentShas: [] })
    ];

    const model = buildRepositoryGraphModel(makePayload(commits), "main");

    expect(model.rows.map((row) => row.id)).toEqual(["head000", "base000"]);
    expect(model.rows[0]?.predecessorIds).toEqual(["base000"]);
    expect(model.svg.totalHeight).toBe(commits.length * COMMIT_GRAPH_ROW_HEIGHT);
  });

  it("creates connector geometry for merge commits", () => {
    const commits = [
      makeCommit({ sha: "head000", committedAt: "2026-05-18T11:00:00Z", parentShas: ["main000", "feature000"], branchHeadNames: ["main"] }),
      makeCommit({ sha: "main000", committedAt: "2026-05-18T10:00:00Z", parentShas: ["base000"] }),
      makeCommit({ sha: "feature000", committedAt: "2026-05-18T09:30:00Z", parentShas: ["base000"] }),
      makeCommit({ sha: "base000", committedAt: "2026-05-18T09:00:00Z", parentShas: [] })
    ];

    const model = buildRepositoryGraphModel(makePayload(commits), "main");

    expect(model.svg.nodes).toHaveLength(commits.length);
    expect(model.svg.rails.length).toBeGreaterThan(1);
    expect(model.svg.graphWidth).toBeGreaterThan(0);
  });
});
