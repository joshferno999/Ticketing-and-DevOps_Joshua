import { describe, expect, it } from "vitest";
import type { RepositoryCommitNode } from "@emergence-devops/shared";
import {
  isLikelyCommitSha,
  rankCommitMatches,
  scoreCommitSimilarity
} from "./commit-search";

function buildCommit(overrides: Partial<RepositoryCommitNode> = {}): RepositoryCommitNode {
  return {
    sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    shortSha: "aaaaaaa",
    messageHeadline: "Fix webhook replay",
    messageBody: "Handles duplicate deliveries",
    authorName: "Ada Lovelace",
    authorLogin: "ada",
    committedAt: "2026-05-19T12:00:00.000Z",
    authoredAt: "2026-05-19T12:00:00.000Z",
    parentShas: [],
    branchHeadNames: [],
    additions: 1,
    deletions: 1,
    changedFiles: 2,
    htmlUrl: "https://example.com/commit/aaaa",
    taggedTaskCount: 0,
    taggedTasksPreview: [],
    ...overrides
  };
}

describe("commit-search", () => {
  it("detects likely commit sha queries", () => {
    expect(isLikelyCommitSha("abc1234")).toBe(true);
    expect(isLikelyCommitSha("^abc1234")).toBe(true);
    expect(isLikelyCommitSha("fix bug")).toBe(false);
  });

  it("ranks sha matches above message matches", () => {
    const shaMatch = buildCommit({
      sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      shortSha: "bbbbbbb",
      messageHeadline: "Unrelated"
    });
    const messageMatch = buildCommit({
      messageHeadline: "fix webhook replay details"
    });

    const ranked = rankCommitMatches("bbbbbbb", [messageMatch, shaMatch], 7);
    expect(ranked[0]?.commit.sha).toBe(shaMatch.sha);
    expect(ranked[0]?.matchLabel).toMatch(/SHA/i);
  });

  it("caps results at seven items", () => {
    const commits = Array.from({ length: 12 }, (_, index) => buildCommit({
      sha: `${index}`.padStart(40, "a"),
      shortSha: `${index}`.padStart(7, "a"),
      messageHeadline: `shared keyword ${index}`
    }));

    expect(rankCommitMatches("shared keyword", commits, 7)).toHaveLength(7);
  });

  it("scores author matches", () => {
    const commit = buildCommit({ authorLogin: "hari", authorName: "Hari" });
    expect(scoreCommitSimilarity("hari", commit)).toBeGreaterThan(scoreCommitSimilarity("hari", buildCommit({
      authorLogin: "other",
      authorName: "Other"
    })));
  });
});
