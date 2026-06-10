export type IntegrationStatus = "not_connected" | "connected" | "error";

export interface WorkspaceCapabilities {
  canEditBoards: boolean;
  canAccessRepos: boolean;
}

export interface AppSessionUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface GitHubActivityLink {
  id: string;
  type: "commit" | "branch" | "pull_request";
  title: string;
  url: string;
  state?: "open" | "merged" | "closed";
  sha?: string;
  pullRequestNumber?: number;
  branchName?: string;
  authorLogin?: string;
  authoredAt: string;
  authorName: string;
}

export interface ActivityCounts {
  commits: number;
  pullRequests: number;
  openPullRequests: number;
  completedPullRequests: number;
}

export interface TaskLinkableCardSummary {
  id: string;
  boardId: string;
  boardName: string;
  asanaTaskGid: string;
  title: string;
  status: string;
  nestingDepth: number;
  parentTaskGid: string;
  parentTitle?: string;
}

export interface TaskSearchResult {
  items: TaskLinkableCardSummary[];
}

export interface GitHubActivitySummary {
  id: string;
  type: "commit" | "pull_request";
  title: string;
  url: string;
  state?: "open" | "merged" | "closed";
  authoredAt: string;
  authorName: string;
  authorLogin?: string;
  sha?: string;
  pullRequestNumber?: number;
  branchName?: string;
  taggedTaskCount: number;
  taggedTasksPreview: TaskLinkableCardSummary[];
}

export interface BoardColumn {
  id: string;
  key: string;
  name: string;
  color: string;
  asanaEnumOptionGid?: string;
}

export interface WorkspaceUserSummary {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  asanaUserGid?: string;
  mentionable: boolean;
}

export interface CardCommentMention {
  appUserId?: string;
  asanaUserGid: string;
  displayName: string;
  start: number;
  length: number;
}

export interface CardComment {
  id: string;
  cardId: string;
  asanaStoryGid: string;
  authorAppUserId?: string;
  authorName: string;
  htmlText: string;
  plainText: string;
  createdAt: string;
  mentions: CardCommentMention[];
}

export interface CreateCardCommentInput {
  body: string;
  mentions: Array<{
    appUserId: string;
    start: number;
    length: number;
  }>;
}

export interface BoardCard {
  id: string;
  boardId: string;
  asanaTaskGid: string;
  parentTaskGid: string;
  rootTaskGid: string;
  ancestryPath: string[];
  nestingDepth: number;
  title: string;
  description: string;
  dueOn?: string;
  dueAt?: string;
  status: string;
  assignee?: string;
  assigneeAppUserId?: string;
  /** True when assigneeName is set but no workspace user is linked (e.g. imported from Asana only). */
  assigneeNotInWorkspace?: boolean;
  priority?: "low" | "medium" | "high" | "critical";
  createdAt: string;
  updatedAt: string;
  tags: string[];
  manualCompletion: boolean;
  activityCounts: ActivityCounts;
  links: GitHubActivityLink[];
}

export interface MoveBoardCardInput {
  targetColumnKey: string;
  dueOn?: string;
}

export interface UpdateBoardCardDueDateInput {
  dueOn: string;
}

export interface UpdateBoardCardAssigneeInput {
  assigneeAppUserId: string | null;
}

export interface UpdateBoardCardManualCompletionInput {
  manualCompletion: boolean;
}

export interface BoardSummary {
  id: string;
  name: string;
  isStarred: boolean;
  asanaParentTaskGid: string;
  workspaceName: string;
  projectName: string;
  columns: BoardColumn[];
  cards: BoardCard[];
}

export interface AsanaParentTaskSearchResult {
  gid: string;
  name: string;
  workspaceName: string;
  projectName?: string;
  completed: boolean;
}

export interface AnalyticsSeriesDatum {
  label: string;
  value: number;
}

export interface AnalyticsTimeWindow {
  start: string;
  end: string;
  weeks: number;
}

export interface AnalyticsCoverageMetric {
  linked: number;
  total: number;
  percentage: number;
}

export interface AnalyticsCoverage {
  pullRequests: AnalyticsCoverageMetric;
  commits: AnalyticsCoverageMetric;
  completedCardsWithGitHubActivity: AnalyticsCoverageMetric;
}

export interface AnalyticsFeatureMixItem {
  feature: string;
  commits: number;
  pullRequests: number;
  workItems: number;
}

export interface AnalyticsRepoMixItem {
  repoId: string;
  repoName: string;
  fullName: string;
  commits: number;
  pullRequests: number;
  additions: number;
  deletions: number;
}

export interface AnalyticsWeeklyScorecardDatum {
  label: string;
  weekStart: string;
  weekEnd: string;
  completedWorkItems: number;
  mergedPullRequests: number;
  commits: number;
  additions: number;
  deletions: number;
  medianCycleTimeDays: number;
  medianPullRequestLatencyHours: number;
  reopenedWorkItems: number;
  reopenedWorkRate: number;
  backlog: number;
  notStarted: number;
  active: number;
  review: number;
  done: number;
}

export interface AnalyticsSummaryMetric {
  median: number;
  p75?: number;
}

export interface AnalyticsTeamScorecard {
  totalCompletedWorkItems: number;
  totalMergedPullRequests: number;
  totalCommits: number;
  additions: number;
  deletions: number;
  churnRatio: number;
  cycleTimeDays: AnalyticsSummaryMetric;
  pullRequestLatencyHours: AnalyticsSummaryMetric;
  reopenedWorkRate: number;
  weekly: AnalyticsWeeklyScorecardDatum[];
  repoMix: AnalyticsRepoMixItem[];
  featureMix: AnalyticsFeatureMixItem[];
  systemActivity: {
    mergeCommits: number;
    botCommits: number;
  };
}

export interface AnalyticsUserMetrics {
  commitsAuthored: number;
  pullRequestsOpened: number;
  pullRequestsMerged: number;
  workItemsCompleted: number;
  medianCycleTimeDays: number;
  medianPullRequestLatencyHours: number;
  additions: number;
  deletions: number;
  churnRatio: number;
  commentCount: number;
  activityCount: number;
}

export interface AnalyticsUserWeeklyDatum {
  label: string;
  weekStart: string;
  weekEnd: string;
  commitsAuthored: number;
  pullRequestsOpened: number;
  pullRequestsMerged: number;
  workItemsCompleted: number;
  additions: number;
  deletions: number;
}

export interface AnalyticsUserScorecard {
  userKey: string;
  displayName: string;
  githubLogin?: string;
  metrics: AnalyticsUserMetrics;
  weeklySeries: AnalyticsUserWeeklyDatum[];
  featureMix: AnalyticsFeatureMixItem[];
  repoMix: AnalyticsRepoMixItem[];
  dataQualityFlags: string[];
}

export interface DoraMetricInstrumentation {
  key:
    | "change_lead_time"
    | "deployment_frequency"
    | "failed_deployment_recovery_time"
    | "change_fail_rate"
    | "deployment_rework_rate";
  label: string;
  status: "not_instrumented";
  reason: string;
  requiredSources: string[];
}

export interface DoraInstrumentationStatus {
  note: string;
  metrics: DoraMetricInstrumentation[];
}

export interface AnalyticsSnapshot {
  throughput: AnalyticsSeriesDatum[];
  cumulativeFlow: Array<AnalyticsSeriesDatum & { backlog: number; notStarted: number; active: number; review: number; done: number }>;
  cycleTimeDays: number;
  leadTimeDays: number;
  mergeLatencyHours: number;
  timeWindow: AnalyticsTimeWindow;
  bucketType: "calendar_week_mon_sun_utc";
  coverage: AnalyticsCoverage;
  teamScorecard: AnalyticsTeamScorecard;
  userScorecards: AnalyticsUserScorecard[];
  doraInstrumentation: DoraInstrumentationStatus;
}

export interface OnboardingState {
  accountConnected: boolean;
  displayName?: string;
  avatarUrl?: string;
  githubInstalled: boolean;
  asanaConnected: boolean;
  boardMapped: boolean;
  columnsMapped: boolean;
  githubInstallations: GitHubInstallationSummary[];
  githubRepositoryCount: number;
}

export interface GitHubRepositorySummary {
  id: string;
  name: string;
  fullName: string;
}

export interface GitHubInstallationSummary {
  id: string;
  accountLogin: string;
  accountType: string;
  targetType: string;
  repositorySelection: "all" | "selected";
  repositoryCount: number;
  settingsUrl?: string;
  repositories: GitHubRepositorySummary[];
}

export interface RepositoryCommitGraphRepo {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
}

export interface RepositoryBranchOption {
  name: string;
  headSha: string;
  isDefault: boolean;
  isIncludedInCurrentScope: boolean;
}

export interface RepositoryCommitPullRequestSummary {
  id: string;
  number: number;
  title: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  url: string;
}

export interface RepositoryPullRequestSummary {
  id: string;
  number: number;
  title: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  url: string;
  authorName: string;
  authorLogin?: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  branchName: string;
  taggedTaskCount: number;
  taggedTasksPreview: TaskLinkableCardSummary[];
}

export interface RepositoryPullRequestListResponse {
  pullRequests: RepositoryPullRequestSummary[];
  pageInfo: {
    offset: number;
    limit: number;
    hasMore: boolean;
    nextOffset: number | null;
    totalPullRequests: number | null;
  };
}

export interface RepositoryCommitNode {
  sha: string;
  shortSha: string;
  messageHeadline: string;
  messageBody: string;
  authorName: string;
  authorLogin?: string;
  authorAvatarUrl?: string;
  committedAt: string;
  authoredAt: string;
  parentShas: string[];
  branchHeadNames: string[];
  additions: number;
  deletions: number;
  changedFiles: number;
  htmlUrl: string;
  taggedTaskCount: number;
  taggedTasksPreview: TaskLinkableCardSummary[];
  pullRequest?: RepositoryCommitPullRequestSummary;
}

export interface CommitTaskLinksResponse {
  activity: GitHubActivitySummary;
  tasks: TaskLinkableCardSummary[];
}

export interface PullRequestTaskLinksResponse {
  activity: GitHubActivitySummary;
  tasks: TaskLinkableCardSummary[];
}

export interface RepositoryCommitGraphResponse {
  repo: RepositoryCommitGraphRepo;
  branchOptions: RepositoryBranchOption[];
  commits: RepositoryCommitNode[];
  pageInfo: {
    offset: number;
    limit: number;
    hasMore: boolean;
    nextOffset: number | null;
    totalCommits: number | null;
  };
}

export interface RepositoryCommitSearchItem {
  commit: RepositoryCommitNode;
  score: number;
  matchLabel: string;
}

export interface RepositoryCommitSearchResponse {
  items: RepositoryCommitSearchItem[];
}
