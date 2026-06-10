import type { AnalyticsSnapshot, BoardSummary, OnboardingState } from "./types";

export const demoOnboardingState: OnboardingState = {
  accountConnected: true,
  githubInstalled: false,
  asanaConnected: false,
  boardMapped: false,
  columnsMapped: false,
  githubInstallations: [],
  githubRepositoryCount: 0
};

export const demoBoard: BoardSummary = {
  id: "board_emergence",
  name: "Platform Reliability Sprint",
  isStarred: true,
  asanaParentTaskGid: "1201234567890001",
  workspaceName: "Emergence Engineering",
  projectName: "Bridge Delivery",
  columns: [
    { id: "col_backlog", key: "backlog", name: "Backlog", color: "#61708a" },
    { id: "col_not_started", key: "not_started", name: "Not Started", color: "#8b95a7" },
    { id: "col_active", key: "active", name: "In Progress", color: "#0284c7" },
    { id: "col_review", key: "review", name: "In PR", color: "#f59e0b" },
    { id: "col_done", key: "done", name: "Done", color: "#10b981" }
  ],
  cards: [
    {
      id: "card_sync_jobs",
      boardId: "board_emergence",
      asanaTaskGid: "1201234567891001",
      parentTaskGid: "1201234567890001",
      rootTaskGid: "1201234567890001",
      ancestryPath: [],
      nestingDepth: 0,
      title: "Implement webhook replay and retry orchestration",
      description: "Capture failed GitHub payloads, replay safely, and expose retry visibility in the dashboard.",
      dueOn: "2026-05-20",
      status: "active",
      assignee: "Hari",
      priority: "high",
      createdAt: "2026-05-10T10:30:00.000Z",
      updatedAt: "2026-05-16T10:30:00.000Z",
      manualCompletion: false,
      activityCounts: { commits: 0, pullRequests: 1, openPullRequests: 1, completedPullRequests: 0 },
      tags: ["webhooks", "backend"],
      links: [
        {
          id: "pr_381",
          type: "pull_request",
          title: "PR #381 webhook idempotency pass",
          url: "https://github.com/example/repo/pull/381",
          state: "open",
          authoredAt: "2026-05-15T14:00:00.000Z",
          authorName: "Hari"
        }
      ]
    },
    {
      id: "card_board_ui",
      boardId: "board_emergence",
      asanaTaskGid: "1201234567891002",
      parentTaskGid: "1201234567890001",
      rootTaskGid: "1201234567890001",
      ancestryPath: [],
      nestingDepth: 0,
      title: "Board drag-and-drop with Asana write-through",
      description: "Move cards between mapped columns and persist enum custom field changes back to Asana.",
      dueAt: "2026-05-19T15:30:00.000Z",
      status: "review",
      assignee: "Engineering",
      priority: "critical",
      createdAt: "2026-05-12T08:00:00.000Z",
      updatedAt: "2026-05-16T08:00:00.000Z",
      manualCompletion: false,
      activityCounts: { commits: 1, pullRequests: 0, openPullRequests: 0, completedPullRequests: 0 },
      tags: ["frontend", "asana"],
      links: [
        {
          id: "commit_a1",
          type: "commit",
          title: "feat: board reorder handling [Asana:1201234567891002]",
          url: "https://github.com/example/repo/commit/a1b2c3d4",
          sha: "a1b2c3d4",
          authoredAt: "2026-05-15T09:20:00.000Z",
          authorName: "Hari"
        },
        {
          id: "branch_1",
          type: "branch",
          title: "feature/asana-1201234567891002-board-sync",
          url: "https://github.com/example/repo/tree/feature/asana-1201234567891002-board-sync",
          authoredAt: "2026-05-14T11:30:00.000Z",
          authorName: "Hari"
        }
      ]
    },
    {
      id: "card_auth",
      boardId: "board_emergence",
      asanaTaskGid: "1201234567891003",
      parentTaskGid: "1201234567890001",
      rootTaskGid: "1201234567890001",
      ancestryPath: [],
      nestingDepth: 0,
      title: "Finalize workspace sign-in onboarding copy",
      description: "Tighten the login and integration setup flow for GitHub and Asana after workspace sign-in.",
      status: "not_started",
      assignee: "Design Systems",
      priority: "medium",
      createdAt: "2026-05-14T07:00:00.000Z",
      updatedAt: "2026-05-16T07:00:00.000Z",
      manualCompletion: false,
      activityCounts: { commits: 0, pullRequests: 0, openPullRequests: 0, completedPullRequests: 0 },
      tags: ["auth", "ux"],
      links: []
    },
    {
      id: "card_metrics",
      boardId: "board_emergence",
      asanaTaskGid: "1201234567891004",
      parentTaskGid: "1201234567890001",
      rootTaskGid: "1201234567890001",
      ancestryPath: [],
      nestingDepth: 0,
      title: "Ship release cadence analytics",
      description: "Expose merge latency, deployment cadence, and board throughput in a single analytics hub.",
      status: "done",
      assignee: "Platform",
      priority: "medium",
      createdAt: "2026-05-08T16:00:00.000Z",
      updatedAt: "2026-05-15T16:00:00.000Z",
      manualCompletion: false,
      activityCounts: { commits: 0, pullRequests: 1, openPullRequests: 0, completedPullRequests: 1 },
      tags: ["analytics", "reporting"],
      links: [
        {
          id: "pr_377",
          type: "pull_request",
          title: "PR #377 analytics cards",
          url: "https://github.com/example/repo/pull/377",
          state: "merged",
          authoredAt: "2026-05-15T13:45:00.000Z",
          authorName: "Hari"
        }
      ]
    }
  ]
};

export const demoAnalytics: AnalyticsSnapshot = {
  throughput: [
    { label: "Mon", value: 3 },
    { label: "Tue", value: 5 },
    { label: "Wed", value: 4 },
    { label: "Thu", value: 6 },
    { label: "Fri", value: 5 }
  ],
  cumulativeFlow: [
    { label: "Mon", value: 12, backlog: 3, notStarted: 3, active: 3, review: 2, done: 1 },
    { label: "Tue", value: 12, backlog: 2, notStarted: 3, active: 3, review: 2, done: 2 },
    { label: "Wed", value: 12, backlog: 2, notStarted: 2, active: 4, review: 2, done: 2 },
    { label: "Thu", value: 12, backlog: 1, notStarted: 2, active: 4, review: 2, done: 3 },
    { label: "Fri", value: 12, backlog: 1, notStarted: 1, active: 3, review: 2, done: 5 }
  ],
  cycleTimeDays: 3.2,
  leadTimeDays: 6.7,
  mergeLatencyHours: 11.5,
  timeWindow: {
    start: "2026-05-12T00:00:00.000Z",
    end: "2026-06-08T23:59:59.999Z",
    weeks: 4
  },
  bucketType: "calendar_week_mon_sun_utc",
  coverage: {
    pullRequests: { linked: 6, total: 8, percentage: 75 },
    commits: { linked: 9, total: 12, percentage: 75 },
    completedCardsWithGitHubActivity: { linked: 4, total: 5, percentage: 80 }
  },
  teamScorecard: {
    totalCompletedWorkItems: 11,
    totalMergedPullRequests: 6,
    totalCommits: 12,
    additions: 920,
    deletions: 210,
    churnRatio: 81.4,
    cycleTimeDays: { median: 3.2, p75: 4.8 },
    pullRequestLatencyHours: { median: 11.5, p75: 18.2 },
    reopenedWorkRate: 9.1,
    weekly: [
      { label: "May 12 - May 18", weekStart: "2026-05-12T00:00:00.000Z", weekEnd: "2026-05-18T23:59:59.999Z", completedWorkItems: 2, mergedPullRequests: 1, commits: 2, additions: 120, deletions: 30, medianCycleTimeDays: 2.7, medianPullRequestLatencyHours: 10.4, reopenedWorkItems: 0, reopenedWorkRate: 0, backlog: 3, notStarted: 3, active: 3, review: 2, done: 1 },
      { label: "May 19 - May 25", weekStart: "2026-05-19T00:00:00.000Z", weekEnd: "2026-05-25T23:59:59.999Z", completedWorkItems: 3, mergedPullRequests: 2, commits: 3, additions: 240, deletions: 40, medianCycleTimeDays: 3.1, medianPullRequestLatencyHours: 11.2, reopenedWorkItems: 1, reopenedWorkRate: 33.3, backlog: 2, notStarted: 3, active: 3, review: 2, done: 2 },
      { label: "May 26 - Jun 1", weekStart: "2026-05-26T00:00:00.000Z", weekEnd: "2026-06-01T23:59:59.999Z", completedWorkItems: 2, mergedPullRequests: 1, commits: 4, additions: 310, deletions: 90, medianCycleTimeDays: 3.8, medianPullRequestLatencyHours: 12.7, reopenedWorkItems: 0, reopenedWorkRate: 0, backlog: 2, notStarted: 2, active: 4, review: 2, done: 2 },
      { label: "Jun 2 - Jun 8", weekStart: "2026-06-02T00:00:00.000Z", weekEnd: "2026-06-08T23:59:59.999Z", completedWorkItems: 4, mergedPullRequests: 2, commits: 3, additions: 250, deletions: 50, medianCycleTimeDays: 3.2, medianPullRequestLatencyHours: 11.5, reopenedWorkItems: 0, reopenedWorkRate: 0, backlog: 1, notStarted: 1, active: 3, review: 2, done: 5 }
    ],
    repoMix: [
      { repoId: "repo_frontend", repoName: "frontend", fullName: "example/frontend", commits: 7, pullRequests: 4, additions: 540, deletions: 120 },
      { repoId: "repo_backend", repoName: "backend", fullName: "example/backend", commits: 5, pullRequests: 2, additions: 380, deletions: 90 }
    ],
    featureMix: [
      { feature: "Infrastructure", commits: 4, pullRequests: 2, workItems: 3 },
      { feature: "Analytics", commits: 3, pullRequests: 2, workItems: 2 },
      { feature: "Roles / Access", commits: 1, pullRequests: 1, workItems: 1 }
    ],
    systemActivity: {
      mergeCommits: 1,
      botCommits: 0
    }
  },
  userScorecards: [
    {
      userKey: "user_hari",
      displayName: "Hari",
      githubLogin: "hari",
      metrics: {
        commitsAuthored: 8,
        pullRequestsOpened: 3,
        pullRequestsMerged: 2,
        workItemsCompleted: 4,
        medianCycleTimeDays: 3.1,
        medianPullRequestLatencyHours: 11.4,
        additions: 610,
        deletions: 160,
        churnRatio: 79.2,
        commentCount: 5,
        activityCount: 16
      },
      weeklySeries: [
        { label: "May 12 - May 18", weekStart: "2026-05-12T00:00:00.000Z", weekEnd: "2026-05-18T23:59:59.999Z", commitsAuthored: 2, pullRequestsOpened: 1, pullRequestsMerged: 0, workItemsCompleted: 1, additions: 120, deletions: 30 },
        { label: "May 19 - May 25", weekStart: "2026-05-19T00:00:00.000Z", weekEnd: "2026-05-25T23:59:59.999Z", commitsAuthored: 2, pullRequestsOpened: 1, pullRequestsMerged: 1, workItemsCompleted: 1, additions: 140, deletions: 20 },
        { label: "May 26 - Jun 1", weekStart: "2026-05-26T00:00:00.000Z", weekEnd: "2026-06-01T23:59:59.999Z", commitsAuthored: 2, pullRequestsOpened: 0, pullRequestsMerged: 0, workItemsCompleted: 1, additions: 170, deletions: 60 },
        { label: "Jun 2 - Jun 8", weekStart: "2026-06-02T00:00:00.000Z", weekEnd: "2026-06-08T23:59:59.999Z", commitsAuthored: 2, pullRequestsOpened: 1, pullRequestsMerged: 1, workItemsCompleted: 1, additions: 180, deletions: 50 }
      ],
      featureMix: [
        { feature: "Infrastructure", commits: 3, pullRequests: 1, workItems: 2 },
        { feature: "Analytics", commits: 2, pullRequests: 2, workItems: 1 }
      ],
      repoMix: [
        { repoId: "repo_frontend", repoName: "frontend", fullName: "example/frontend", commits: 4, pullRequests: 2, additions: 330, deletions: 70 },
        { repoId: "repo_backend", repoName: "backend", fullName: "example/backend", commits: 4, pullRequests: 1, additions: 280, deletions: 90 }
      ],
      dataQualityFlags: []
    }
  ],
  doraInstrumentation: {
    note: "DORA metrics are intended for application or service-level improvement over time, not for individual ranking.",
    metrics: [
      { key: "change_lead_time", label: "Change lead time", status: "not_instrumented", reason: "Current analytics stop before a successful production deployment event.", requiredSources: ["deployment events"] },
      { key: "deployment_frequency", label: "Deployment frequency", status: "not_instrumented", reason: "The system does not yet persist production deployment events per service.", requiredSources: ["deployment events"] },
      { key: "failed_deployment_recovery_time", label: "Failed deployment recovery time", status: "not_instrumented", reason: "Recovery timestamps for deployment-caused incidents are not captured.", requiredSources: ["production failure / rollback events", "incident recovery timestamps"] },
      { key: "change_fail_rate", label: "Change fail rate", status: "not_instrumented", reason: "Production failures are not linked back to deployments in the current model.", requiredSources: ["production failure / rollback events", "deployment events"] },
      { key: "deployment_rework_rate", label: "Deployment rework rate", status: "not_instrumented", reason: "Unplanned fix deployments are not explicitly tracked today.", requiredSources: ["deployment events", "unplanned fix deployments"] }
    ]
  }
};
