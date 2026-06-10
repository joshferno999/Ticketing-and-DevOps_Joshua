import { describe, expect, it } from "vitest";
import { buildAnalyticsReportBundle } from "./analytics-builder";

describe("buildAnalyticsReportBundle", () => {
  it("merges user identities by GitHub login and display name without double counting", () => {
    const now = new Date("2026-05-20T10:00:00.000Z");
    const bundle = buildAnalyticsReportBundle({
      now,
      weeks: 2,
      appUsers: [
        {
          id: "user_hari",
          email: "hari@example.com",
          displayName: "Hari",
          githubAccountLogin: "hari"
        }
      ],
      cards: [
        {
          id: "card_1",
          title: "Ship analytics panel",
          description: "Balanced analytics",
          tags: ["analytics"],
          statusKey: "done",
          createdAt: new Date("2026-05-12T10:00:00.000Z"),
          updatedAt: new Date("2026-05-15T10:00:00.000Z"),
          boardName: "Platform",
          importedByAppUserId: "user_hari",
          assigneeAppUserId: "user_hari",
          linkedActivityIds: ["commit:1", "pr:1"],
          statusEvents: [
            { fromStatus: "active", toStatus: "done", changedAt: new Date("2026-05-15T10:00:00.000Z") }
          ],
          comments: [
            { authorAppUserId: "user_hari", authorName: "Hari", createdAt: new Date("2026-05-14T10:00:00.000Z") }
          ]
        }
      ],
      activities: [
        {
          id: "commit:1",
          type: "commit",
          repoId: "repo_a",
          repoName: "frontend",
          repoFullName: "example/frontend",
          title: "feat: analytics panel",
          authoredAt: new Date("2026-05-14T12:00:00.000Z"),
          authorName: "Hari",
          authorLogin: "hari",
          linkedCardIds: ["card_1"],
          additions: 120,
          deletions: 20,
          isMergeCommit: false,
          isBot: false
        },
        {
          id: "pr:1",
          type: "pull_request",
          repoId: "repo_a",
          repoName: "frontend",
          repoFullName: "example/frontend",
          title: "Analytics cards",
          authoredAt: new Date("2026-05-14T13:00:00.000Z"),
          authorName: "Hari",
          linkedCardIds: ["card_1"],
          additions: 0,
          deletions: 0,
          mergedAt: new Date("2026-05-15T14:00:00.000Z"),
          state: "merged",
          isMergeCommit: false,
          isBot: false
        }
      ]
    });

    expect(bundle.snapshot.userScorecards).toHaveLength(1);
    expect(bundle.snapshot.userScorecards[0]?.userKey).toBe("user_hari");
    expect(bundle.snapshot.userScorecards[0]?.metrics.commitsAuthored).toBe(1);
    expect(bundle.snapshot.userScorecards[0]?.metrics.pullRequestsMerged).toBe(1);
    expect(bundle.snapshot.coverage.commits.percentage).toBe(100);
  });

  it("excludes merge commits and bot commits from per-user contribution totals while preserving system activity", () => {
    const bundle = buildAnalyticsReportBundle({
      now: new Date("2026-05-20T10:00:00.000Z"),
      weeks: 1,
      appUsers: [],
      cards: [],
      activities: [
        {
          id: "commit:merge",
          type: "commit",
          repoId: "repo_a",
          repoName: "frontend",
          repoFullName: "example/frontend",
          title: "Merge pull request #10 from branch",
          authoredAt: new Date("2026-05-19T10:00:00.000Z"),
          authorName: "Merge Bot",
          authorLogin: "github-actions[bot]",
          linkedCardIds: [],
          additions: 10,
          deletions: 2,
          isMergeCommit: true,
          isBot: true
        }
      ]
    });

    expect(bundle.snapshot.teamScorecard.totalCommits).toBe(0);
    expect(bundle.snapshot.teamScorecard.systemActivity.mergeCommits).toBe(1);
    expect(bundle.snapshot.teamScorecard.systemActivity.botCommits).toBe(1);
    expect(bundle.snapshot.userScorecards[0]?.userKey).toBe("unknown-unmapped");
    expect(bundle.snapshot.userScorecards[0]?.metrics.commitsAuthored).toBe(0);
  });

  it("calculates weekly buckets, reopened work rate, and keeps DORA metrics explicitly uninstrumented", () => {
    const bundle = buildAnalyticsReportBundle({
      now: new Date("2026-05-20T10:00:00.000Z"),
      weeks: 2,
      appUsers: [
        {
          id: "user_a",
          email: "a@example.com",
          displayName: "Alex",
          githubAccountLogin: "alex"
        }
      ],
      cards: [
        {
          id: "card_reopen",
          title: "Stabilize release tracking",
          description: "",
          tags: ["infra"],
          statusKey: "done",
          createdAt: new Date("2026-05-05T10:00:00.000Z"),
          updatedAt: new Date("2026-05-19T12:00:00.000Z"),
          boardName: "Platform",
          importedByAppUserId: "user_a",
          assigneeAppUserId: "user_a",
          linkedActivityIds: [],
          statusEvents: [
            { fromStatus: "active", toStatus: "done", changedAt: new Date("2026-05-12T09:00:00.000Z") },
            { fromStatus: "done", toStatus: "active", changedAt: new Date("2026-05-13T09:00:00.000Z") },
            { fromStatus: "active", toStatus: "done", changedAt: new Date("2026-05-19T09:00:00.000Z") }
          ],
          comments: []
        }
      ],
      activities: []
    });

    expect(bundle.snapshot.teamScorecard.weekly).toHaveLength(2);
    expect(bundle.snapshot.teamScorecard.reopenedWorkRate).toBeGreaterThan(0);
    expect(bundle.snapshot.doraInstrumentation.metrics.every((metric) => metric.status === "not_instrumented")).toBe(true);
    expect(bundle.snapshot.bucketType).toBe("calendar_week_mon_sun_utc");
  });
});
