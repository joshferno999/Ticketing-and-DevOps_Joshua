export const demoOnboardingState = {
    accountConnected: true,
    githubInstalled: false,
    asanaConnected: false,
    boardMapped: false,
    columnsMapped: false,
    githubInstallations: [],
    githubRepositoryCount: 0
};
export const demoBoard = {
    id: "board_emergence",
    name: "Platform Reliability Sprint",
    isStarred: true,
    asanaParentTaskGid: "1201234567890001",
    workspaceName: "Emergence Engineering",
    projectName: "Bridge Delivery",
    columns: [
        { id: "col_backlog", key: "backlog", name: "Backlog", color: "#61708a" },
        { id: "col_active", key: "active", name: "In Progress", color: "#0284c7" },
        { id: "col_review", key: "review", name: "In PR", color: "#f59e0b" },
        { id: "col_done", key: "done", name: "Done", color: "#10b981" }
    ],
    cards: [
        {
            id: "card_sync_jobs",
            boardId: "board_emergence",
            asanaTaskGid: "1201234567891001",
            title: "Implement webhook replay and retry orchestration",
            description: "Capture failed GitHub payloads, replay safely, and expose retry visibility in the dashboard.",
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
            title: "Board drag-and-drop with Asana write-through",
            description: "Move cards between mapped columns and persist enum custom field changes back to Asana.",
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
            title: "Finalize Neon Auth onboarding copy",
            description: "Tighten the login and integration setup flow for GitHub and Asana after Neon Auth sign-in.",
            status: "backlog",
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
export const demoAnalytics = {
    throughput: [
        { label: "Mon", value: 3 },
        { label: "Tue", value: 5 },
        { label: "Wed", value: 4 },
        { label: "Thu", value: 6 },
        { label: "Fri", value: 5 }
    ],
    cumulativeFlow: [
        { label: "Mon", value: 12, todo: 6, active: 3, review: 2, done: 1 },
        { label: "Tue", value: 12, todo: 5, active: 3, review: 2, done: 2 },
        { label: "Wed", value: 12, todo: 4, active: 4, review: 2, done: 2 },
        { label: "Thu", value: 12, todo: 3, active: 4, review: 2, done: 3 },
        { label: "Fri", value: 12, todo: 2, active: 3, review: 2, done: 5 }
    ],
    cycleTimeDays: 3.2,
    leadTimeDays: 6.7,
    mergeLatencyHours: 11.5
};
