import type {
  AnalyticsCoverage,
  AnalyticsFeatureMixItem,
  AnalyticsRepoMixItem,
  AnalyticsSnapshot,
  AnalyticsUserScorecard,
  DoraInstrumentationStatus
} from "@emergence-devops/shared";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_HOUR = 1000 * 60 * 60;
const UNKNOWN_USER_KEY = "unknown-unmapped";
const UNKNOWN_USER_NAME = "Unknown / Unmapped";
const DEFAULT_BUCKET_TYPE = "calendar_week_mon_sun_utc" as const;

const FEATURE_RULES: Array<{ feature: string; keywords: string[] }> = [
  { feature: "Deal Command Center", keywords: ["dcc", "deal command", "dealcommand", "diligence", "buy_box", "buy box", "banker_referral"] },
  { feature: "Email Dashboard", keywords: ["email", "mailbox", "domain", "sequence", "amplemarket", "emailbison", "heyreach", "trends", "kpi"] },
  { feature: "Sourcing Lead Pipeline", keywords: ["sourcing", "lead", "pipeline"] },
  { feature: "Design System", keywords: ["bootstrap", "shadcn", "tailwind", "css", "theme", "dark mode", "color"] },
  { feature: "Banker CRM", keywords: ["banker", "bankercrm"] },
  { feature: "Reply Dashboard", keywords: ["reply", "replydashboard", "calendar event"] },
  { feature: "Infrastructure", keywords: ["redis", "gunicorn", "wsgi", "postgres", "cache", "health check", "gevent", "deploy"] },
  { feature: "War Room", keywords: ["war_room", "warroom"] },
  { feature: "NDA Guardian", keywords: ["nda"] },
  { feature: "PSQ Forms", keywords: ["psq"] },
  { feature: "Sequence Builder", keywords: ["sequencebuilder", "engine report", "vertical focus"] },
  { feature: "Roles / Access", keywords: ["roles", "permission", "access"] }
];

type RawAppUser = {
  id: string;
  email: string;
  displayName?: string | null;
  githubAccountLogin?: string | null;
};

type RawCardStatusEvent = {
  fromStatus?: string | null;
  toStatus: string;
  changedAt: Date;
};

type RawCardComment = {
  authorAppUserId?: string | null;
  authorName: string;
  createdAt: Date;
};

type RawCard = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  statusKey: string;
  createdAt: Date;
  updatedAt: Date;
  boardName: string;
  importedByAppUserId: string;
  assigneeAppUserId?: string | null;
  linkedActivityIds: string[];
  statusEvents: RawCardStatusEvent[];
  comments: RawCardComment[];
};

type RawActivity = {
  id: string;
  type: "commit" | "pull_request";
  repoId: string;
  repoName: string;
  repoFullName: string;
  title: string;
  authoredAt: Date;
  authorName: string;
  authorLogin?: string | null;
  linkedCardIds: string[];
  additions: number;
  deletions: number;
  mergedAt?: Date | null;
  state?: string | null;
  isMergeCommit?: boolean;
  isBot?: boolean;
};

type AnalyticsBuilderInput = {
  now: Date;
  weeks: number;
  appUsers: RawAppUser[];
  cards: RawCard[];
  activities: RawActivity[];
};

export type AnalyticsDatasetUser = {
  userKey: string;
  displayName: string;
  githubLogin?: string;
};

export type AnalyticsDatasetRepo = {
  repoId: string;
  repoName: string;
  fullName: string;
};

export type AnalyticsDatasetCommit = {
  id: string;
  repoId: string;
  repoName: string;
  fullName: string;
  authoredAt: string;
  authorName: string;
  authorLogin?: string;
  userKey: string;
  feature: string;
  additions: number;
  deletions: number;
  linkedCardIds: string[];
  isBot: boolean;
  isMergeCommit: boolean;
};

export type AnalyticsDatasetPullRequest = {
  id: string;
  repoId: string;
  repoName: string;
  fullName: string;
  authoredAt: string;
  mergedAt?: string;
  authorName: string;
  authorLogin?: string;
  userKey: string;
  feature: string;
  linkedCardIds: string[];
  state?: string;
  latencyHours?: number;
};

export type AnalyticsDatasetWorkItem = {
  cardId: string;
  title: string;
  feature: string;
  userKey: string;
  statusKey: string;
  createdAt: string;
  completedAt?: string;
  cycleTimeDays?: number;
  hasGitHubActivity: boolean;
};

export type AnalyticsTimeBucket = {
  label: string;
  weekStart: string;
  weekEnd: string;
};

export type AnalyticsReportBundle = {
  snapshot: AnalyticsSnapshot;
  dataset: {
    users: AnalyticsDatasetUser[];
    repos: AnalyticsDatasetRepo[];
    commits: AnalyticsDatasetCommit[];
    pullRequests: AnalyticsDatasetPullRequest[];
    workItems: AnalyticsDatasetWorkItem[];
    statusEvents: Array<{ cardId: string; fromStatus?: string; toStatus: string; changedAt: string }>;
    timeBuckets: AnalyticsTimeBucket[];
    derivedMetrics: {
      coverage: AnalyticsCoverage;
      doraInstrumentation: DoraInstrumentationStatus;
      teamScorecard: AnalyticsSnapshot["teamScorecard"];
      userScorecards: AnalyticsUserScorecard[];
    };
  };
};

type ResolvedUser = {
  userKey: string;
  displayName: string;
  githubLogin?: string;
  appUserId?: string;
};

type NormalizedWorkItem = {
  cardId: string;
  title: string;
  feature: string;
  userKey: string;
  statusKey: string;
  createdAt: Date;
  completedAt?: Date;
  cycleTimeDays?: number;
  linkedActivityIds: string[];
  comments: RawCardComment[];
  statusEvents: RawCardStatusEvent[];
};

type NormalizedActivity = {
  id: string;
  type: "commit" | "pull_request";
  repoId: string;
  repoName: string;
  repoFullName: string;
  title: string;
  authoredAt: Date;
  authorName: string;
  authorLogin?: string;
  userKey: string;
  feature: string;
  linkedCardIds: string[];
  additions: number;
  deletions: number;
  mergedAt?: Date;
  latencyHours?: number;
  state?: string;
  isBot: boolean;
  isMergeCommit: boolean;
};

type WeekBucket = {
  label: string;
  weekStart: Date;
  weekEnd: Date;
};

export function buildAnalyticsReportBundle(input: AnalyticsBuilderInput): AnalyticsReportBundle {
  const weeks = Math.max(1, input.weeks);
  const buckets = buildWeekBuckets(input.now, weeks);
  const firstBucketStart = buckets[0]?.weekStart ?? startOfUtcWeek(input.now);
  const lastBucketEnd = buckets.at(-1)?.weekEnd ?? endOfUtcWeek(input.now);
  const appUsers = buildUserDirectory(input.appUsers);
  const cardsById = new Map(input.cards.map((card) => [card.id, card]));
  const workItems = input.cards.map((card) => normalizeWorkItem(card, appUsers));
  const workItemsById = new Map(workItems.map((item) => [item.cardId, item]));
  const activities = input.activities.map((activity) => normalizeActivity(activity, appUsers, cardsById, workItemsById));

  const visibleCommits = activities.filter((activity) => activity.type === "commit");
  const userCommits = visibleCommits.filter((commit) => !commit.isBot && !commit.isMergeCommit);
  const pullRequests = activities.filter((activity) => activity.type === "pull_request");
  const completedItems = workItems.filter((item) => item.completedAt);
  const windowCompletedItems = completedItems.filter((item) => isWithinWindow(item.completedAt!, firstBucketStart, lastBucketEnd));
  const windowPullRequests = pullRequests.filter((item) => isWithinWindow(item.authoredAt, firstBucketStart, lastBucketEnd) || (item.mergedAt && isWithinWindow(item.mergedAt, firstBucketStart, lastBucketEnd)));
  const windowCommits = userCommits.filter((item) => isWithinWindow(item.authoredAt, firstBucketStart, lastBucketEnd));
  const windowReopenedEvents = workItems.flatMap((item) =>
    item.statusEvents
      .filter((event) => isReopenedTransition(event) && isWithinWindow(event.changedAt, firstBucketStart, lastBucketEnd))
      .map((event) => ({ cardId: item.cardId, event }))
  );

  const teamWeekly = buckets.map((bucket) => buildWeeklyTeamDatum(bucket, workItems, userCommits, pullRequests));
  const featureMix = buildFeatureMix(windowCommits, windowPullRequests, windowCompletedItems);
  const repoMix = buildRepoMix(windowCommits, windowPullRequests);
  const coverage = buildCoverage(windowCommits, windowPullRequests, windowCompletedItems);
  const doraInstrumentation = buildDoraInstrumentation();
  const knownUsers = collectPresentUsers(appUsers, workItems, activities);
  const userScorecards = knownUsers.map((user) =>
    buildUserScorecard(user, buckets, workItems, userCommits, pullRequests)
  );

  const cycleTimeValues = windowCompletedItems
    .map((item) => item.cycleTimeDays)
    .filter((value): value is number => typeof value === "number");
  const mergedLatencyValues = windowPullRequests
    .map((item) => item.latencyHours)
    .filter((value): value is number => typeof value === "number");

  const teamScorecard: AnalyticsSnapshot["teamScorecard"] = {
    totalCompletedWorkItems: windowCompletedItems.length,
    totalMergedPullRequests: windowPullRequests.filter((item) => item.mergedAt && isWithinWindow(item.mergedAt, firstBucketStart, lastBucketEnd)).length,
    totalCommits: windowCommits.length,
    additions: sum(windowCommits.map((item) => item.additions)),
    deletions: sum(windowCommits.map((item) => item.deletions)),
    churnRatio: safePercent(sum(windowCommits.map((item) => item.additions)), sum(windowCommits.map((item) => item.additions + item.deletions))),
    cycleTimeDays: {
      median: roundNumber(median(cycleTimeValues)),
      p75: roundNumber(percentile(cycleTimeValues, 75))
    },
    pullRequestLatencyHours: {
      median: roundNumber(median(mergedLatencyValues)),
      p75: roundNumber(percentile(mergedLatencyValues, 75))
    },
    reopenedWorkRate: safePercent(windowReopenedEvents.length, windowCompletedItems.length),
    weekly: teamWeekly,
    repoMix,
    featureMix,
    systemActivity: {
      mergeCommits: visibleCommits.filter((commit) => commit.isMergeCommit && isWithinWindow(commit.authoredAt, firstBucketStart, lastBucketEnd)).length,
      botCommits: visibleCommits.filter((commit) => commit.isBot && isWithinWindow(commit.authoredAt, firstBucketStart, lastBucketEnd)).length
    }
  };

  const snapshot: AnalyticsSnapshot = {
    throughput: teamWeekly.map((entry) => ({ label: entry.label, value: entry.completedWorkItems })),
    cumulativeFlow: teamWeekly.map((entry) => ({
      label: entry.label,
      value: entry.backlog + entry.notStarted + entry.active + entry.review + entry.done,
      backlog: entry.backlog,
      notStarted: entry.notStarted,
      active: entry.active,
      review: entry.review,
      done: entry.done
    })),
    cycleTimeDays: roundNumber(median(cycleTimeValues)),
    leadTimeDays: roundNumber(mean(cycleTimeValues)),
    mergeLatencyHours: roundNumber(median(mergedLatencyValues)),
    timeWindow: {
      start: firstBucketStart.toISOString(),
      end: lastBucketEnd.toISOString(),
      weeks
    },
    bucketType: DEFAULT_BUCKET_TYPE,
    coverage,
    teamScorecard,
    userScorecards,
    doraInstrumentation
  };

  return {
    snapshot,
    dataset: {
      users: knownUsers.map((user) => ({
        userKey: user.userKey,
        displayName: user.displayName,
        githubLogin: user.githubLogin
      })),
      repos: buildDatasetRepos(activities),
      commits: visibleCommits.map((activity) => ({
        id: activity.id,
        repoId: activity.repoId,
        repoName: activity.repoName,
        fullName: activity.repoFullName,
        authoredAt: activity.authoredAt.toISOString(),
        authorName: activity.authorName,
        authorLogin: activity.authorLogin,
        userKey: activity.userKey,
        feature: activity.feature,
        additions: activity.additions,
        deletions: activity.deletions,
        linkedCardIds: activity.linkedCardIds,
        isBot: activity.isBot,
        isMergeCommit: activity.isMergeCommit
      })),
      pullRequests: pullRequests.map((activity) => ({
        id: activity.id,
        repoId: activity.repoId,
        repoName: activity.repoName,
        fullName: activity.repoFullName,
        authoredAt: activity.authoredAt.toISOString(),
        mergedAt: activity.mergedAt?.toISOString(),
        authorName: activity.authorName,
        authorLogin: activity.authorLogin,
        userKey: activity.userKey,
        feature: activity.feature,
        linkedCardIds: activity.linkedCardIds,
        state: activity.state,
        latencyHours: activity.latencyHours
      })),
      workItems: workItems.map((item) => ({
        cardId: item.cardId,
        title: item.title,
        feature: item.feature,
        userKey: item.userKey,
        statusKey: item.statusKey,
        createdAt: item.createdAt.toISOString(),
        completedAt: item.completedAt?.toISOString(),
        cycleTimeDays: item.cycleTimeDays,
        hasGitHubActivity: item.linkedActivityIds.length > 0
      })),
      statusEvents: workItems.flatMap((item) =>
        item.statusEvents.map((event) => ({
          cardId: item.cardId,
          fromStatus: event.fromStatus ?? undefined,
          toStatus: event.toStatus,
          changedAt: event.changedAt.toISOString()
        }))
      ),
      timeBuckets: buckets.map((bucket) => ({
        label: bucket.label,
        weekStart: bucket.weekStart.toISOString(),
        weekEnd: bucket.weekEnd.toISOString()
      })),
      derivedMetrics: {
        coverage,
        doraInstrumentation,
        teamScorecard,
        userScorecards
      }
    }
  };
}

function buildUserDirectory(users: RawAppUser[]) {
  const byId = new Map<string, ResolvedUser>();
  const byLogin = new Map<string, ResolvedUser>();
  const byName = new Map<string, ResolvedUser>();

  for (const user of users) {
    const displayName = user.displayName?.trim() || user.email.split("@")[0] || user.id;
    const resolved: ResolvedUser = {
      userKey: user.id,
      displayName,
      githubLogin: user.githubAccountLogin ?? undefined,
      appUserId: user.id
    };
    byId.set(user.id, resolved);
    if (user.githubAccountLogin) {
      byLogin.set(normalizeText(user.githubAccountLogin), resolved);
    }
    byName.set(normalizeText(displayName), resolved);
    byName.set(normalizeText(user.email.split("@")[0] ?? ""), resolved);
  }

  return { byId, byLogin, byName };
}

function normalizeWorkItem(card: RawCard, users: ReturnType<typeof buildUserDirectory>): NormalizedWorkItem {
  const feature = classifyFeature([card.title, card.description, card.tags.join(" "), card.boardName]);
  const completedAt = determineCompletedAt(card);
  const owner =
    (card.assigneeAppUserId ? users.byId.get(card.assigneeAppUserId) : undefined) ??
    users.byId.get(card.importedByAppUserId) ??
    unknownUser();

  return {
    cardId: card.id,
    title: card.title,
    feature,
    userKey: owner.userKey,
    statusKey: card.statusKey,
    createdAt: card.createdAt,
    completedAt,
    cycleTimeDays: completedAt
      ? roundNumber(Math.max(0, completedAt.getTime() - card.createdAt.getTime()) / MS_PER_DAY)
      : undefined,
    linkedActivityIds: card.linkedActivityIds,
    comments: card.comments,
    statusEvents: [...card.statusEvents].sort((left, right) => left.changedAt.getTime() - right.changedAt.getTime())
  };
}

function normalizeActivity(
  activity: RawActivity,
  users: ReturnType<typeof buildUserDirectory>,
  cardsById: Map<string, RawCard>,
  workItemsById: Map<string, NormalizedWorkItem>
): NormalizedActivity {
  const resolved = resolveActivityUser(activity, users, cardsById);
  const linkedFeatures = activity.linkedCardIds
    .map((cardId) => workItemsById.get(cardId)?.feature)
    .filter((feature): feature is string => Boolean(feature));
  const feature = mostCommon(linkedFeatures) ?? classifyFeature([activity.title]);
  const isBot = Boolean(activity.isBot) || (activity.authorLogin?.endsWith("[bot]") ?? false);
  const isMergeCommit = Boolean(activity.isMergeCommit) || isLikelyMergeCommit(activity.title);
  const mergedAt = activity.mergedAt ?? undefined;
  const latencyHours =
    activity.type === "pull_request" && mergedAt
      ? roundNumber(Math.max(0, mergedAt.getTime() - activity.authoredAt.getTime()) / MS_PER_HOUR)
      : undefined;

  return {
    id: activity.id,
    type: activity.type,
    repoId: activity.repoId,
    repoName: activity.repoName,
    repoFullName: activity.repoFullName,
    title: activity.title,
    authoredAt: activity.authoredAt,
    authorName: activity.authorName,
    authorLogin: activity.authorLogin ?? undefined,
    userKey: resolved.userKey,
    feature,
    linkedCardIds: activity.linkedCardIds,
    additions: Math.max(0, activity.additions),
    deletions: Math.max(0, activity.deletions),
    mergedAt,
    latencyHours,
    state: activity.state ?? undefined,
    isBot,
    isMergeCommit
  };
}

function buildWeeklyTeamDatum(
  bucket: WeekBucket,
  workItems: NormalizedWorkItem[],
  commits: NormalizedActivity[],
  pullRequests: NormalizedActivity[]
): AnalyticsSnapshot["teamScorecard"]["weekly"][number] {
  const completed = workItems.filter((item) => item.completedAt && isWithinWindow(item.completedAt, bucket.weekStart, bucket.weekEnd));
  const mergedPullRequests = pullRequests.filter((item) => item.mergedAt && isWithinWindow(item.mergedAt, bucket.weekStart, bucket.weekEnd));
  const weeklyCommits = commits.filter((item) => isWithinWindow(item.authoredAt, bucket.weekStart, bucket.weekEnd));
  const reopenedEvents = workItems.flatMap((item) =>
    item.statusEvents.filter((event) => isReopenedTransition(event) && isWithinWindow(event.changedAt, bucket.weekStart, bucket.weekEnd))
  );
  const cycleTimes = completed.map((item) => item.cycleTimeDays).filter((value): value is number => typeof value === "number");
  const prLatencies = mergedPullRequests
    .map((item) => item.latencyHours)
    .filter((value): value is number => typeof value === "number");
  const statusCounts = countStatusesAt(workItems, bucket.weekEnd);

  return {
    label: bucket.label,
    weekStart: bucket.weekStart.toISOString(),
    weekEnd: bucket.weekEnd.toISOString(),
    completedWorkItems: completed.length,
    mergedPullRequests: mergedPullRequests.length,
    commits: weeklyCommits.length,
    additions: sum(weeklyCommits.map((item) => item.additions)),
    deletions: sum(weeklyCommits.map((item) => item.deletions)),
    medianCycleTimeDays: roundNumber(median(cycleTimes)),
    medianPullRequestLatencyHours: roundNumber(median(prLatencies)),
    reopenedWorkItems: reopenedEvents.length,
    reopenedWorkRate: safePercent(reopenedEvents.length, completed.length),
    backlog: statusCounts.backlog,
    notStarted: statusCounts.notStarted,
    active: statusCounts.active,
    review: statusCounts.review,
    done: statusCounts.done
  };
}

function buildFeatureMix(
  commits: NormalizedActivity[],
  pullRequests: NormalizedActivity[],
  workItems: NormalizedWorkItem[]
): AnalyticsFeatureMixItem[] {
  const byFeature = new Map<string, AnalyticsFeatureMixItem>();

  const ensure = (feature: string) => {
    const current = byFeature.get(feature);
    if (current) {
      return current;
    }
    const next: AnalyticsFeatureMixItem = { feature, commits: 0, pullRequests: 0, workItems: 0 };
    byFeature.set(feature, next);
    return next;
  };

  for (const commit of commits) {
    ensure(commit.feature).commits += 1;
  }
  for (const pullRequest of pullRequests) {
    ensure(pullRequest.feature).pullRequests += 1;
  }
  for (const workItem of workItems) {
    ensure(workItem.feature).workItems += 1;
  }

  return [...byFeature.values()].sort((left, right) =>
    right.commits + right.pullRequests + right.workItems - (left.commits + left.pullRequests + left.workItems)
  );
}

function buildRepoMix(commits: NormalizedActivity[], pullRequests: NormalizedActivity[]): AnalyticsRepoMixItem[] {
  const byRepo = new Map<string, AnalyticsRepoMixItem>();

  const ensure = (activity: NormalizedActivity) => {
    const key = activity.repoId;
    const existing = byRepo.get(key);
    if (existing) {
      return existing;
    }
    const created: AnalyticsRepoMixItem = {
      repoId: activity.repoId,
      repoName: activity.repoName,
      fullName: activity.repoFullName,
      commits: 0,
      pullRequests: 0,
      additions: 0,
      deletions: 0
    };
    byRepo.set(key, created);
    return created;
  };

  for (const commit of commits) {
    const repo = ensure(commit);
    repo.commits += 1;
    repo.additions += commit.additions;
    repo.deletions += commit.deletions;
  }

  for (const pullRequest of pullRequests) {
    ensure(pullRequest).pullRequests += 1;
  }

  return [...byRepo.values()].sort((left, right) => right.commits + right.pullRequests - (left.commits + left.pullRequests));
}

function buildCoverage(
  commits: NormalizedActivity[],
  pullRequests: NormalizedActivity[],
  workItems: NormalizedWorkItem[]
): AnalyticsCoverage {
  const linkedPullRequests = pullRequests.filter((item) => item.linkedCardIds.length > 0).length;
  const linkedCommits = commits.filter((item) => item.linkedCardIds.length > 0).length;
  const completedWithGitHub = workItems.filter((item) => item.completedAt && item.linkedActivityIds.length > 0).length;

  return {
    pullRequests: {
      linked: linkedPullRequests,
      total: pullRequests.length,
      percentage: safePercent(linkedPullRequests, pullRequests.length)
    },
    commits: {
      linked: linkedCommits,
      total: commits.length,
      percentage: safePercent(linkedCommits, commits.length)
    },
    completedCardsWithGitHubActivity: {
      linked: completedWithGitHub,
      total: workItems.filter((item) => item.completedAt).length,
      percentage: safePercent(completedWithGitHub, workItems.filter((item) => item.completedAt).length)
    }
  };
}

function buildUserScorecard(
  user: ResolvedUser,
  buckets: WeekBucket[],
  workItems: NormalizedWorkItem[],
  commits: NormalizedActivity[],
  pullRequests: NormalizedActivity[]
): AnalyticsUserScorecard {
  const ownedWorkItems = workItems.filter((item) => item.userKey === user.userKey && item.completedAt);
  const ownedCommits = commits.filter((item) => item.userKey === user.userKey);
  const ownedPullRequests = pullRequests.filter((item) => item.userKey === user.userKey);
  const commentCount = workItems.reduce((sum, item) => {
    const local = item.comments.filter((comment) => comment.authorAppUserId === user.appUserId).length;
    return sum + local;
  }, 0);
  const cycleTimes = ownedWorkItems.map((item) => item.cycleTimeDays).filter((value): value is number => typeof value === "number");
  const prLatencies = ownedPullRequests.map((item) => item.latencyHours).filter((value): value is number => typeof value === "number");
  const weeklySeries = buckets.map((bucket) => ({
    label: bucket.label,
    weekStart: bucket.weekStart.toISOString(),
    weekEnd: bucket.weekEnd.toISOString(),
    commitsAuthored: ownedCommits.filter((item) => isWithinWindow(item.authoredAt, bucket.weekStart, bucket.weekEnd)).length,
    pullRequestsOpened: ownedPullRequests.filter((item) => isWithinWindow(item.authoredAt, bucket.weekStart, bucket.weekEnd)).length,
    pullRequestsMerged: ownedPullRequests.filter((item) => item.mergedAt && isWithinWindow(item.mergedAt, bucket.weekStart, bucket.weekEnd)).length,
    workItemsCompleted: ownedWorkItems.filter((item) => item.completedAt && isWithinWindow(item.completedAt, bucket.weekStart, bucket.weekEnd)).length,
    additions: sum(ownedCommits.filter((item) => isWithinWindow(item.authoredAt, bucket.weekStart, bucket.weekEnd)).map((item) => item.additions)),
    deletions: sum(ownedCommits.filter((item) => isWithinWindow(item.authoredAt, bucket.weekStart, bucket.weekEnd)).map((item) => item.deletions))
  }));

  return {
    userKey: user.userKey,
    displayName: user.displayName,
    githubLogin: user.githubLogin,
    metrics: {
      commitsAuthored: ownedCommits.length,
      pullRequestsOpened: ownedPullRequests.length,
      pullRequestsMerged: ownedPullRequests.filter((item) => item.mergedAt).length,
      workItemsCompleted: ownedWorkItems.length,
      medianCycleTimeDays: roundNumber(median(cycleTimes)),
      medianPullRequestLatencyHours: roundNumber(median(prLatencies)),
      additions: sum(ownedCommits.map((item) => item.additions)),
      deletions: sum(ownedCommits.map((item) => item.deletions)),
      churnRatio: safePercent(sum(ownedCommits.map((item) => item.additions)), sum(ownedCommits.map((item) => item.additions + item.deletions))),
      commentCount,
      activityCount: ownedCommits.length + ownedPullRequests.length + commentCount
    },
    weeklySeries,
    featureMix: buildFeatureMix(ownedCommits, ownedPullRequests, ownedWorkItems),
    repoMix: buildRepoMix(ownedCommits, ownedPullRequests),
    dataQualityFlags: buildDataQualityFlags(user, ownedCommits, ownedPullRequests)
  };
}

function buildDataQualityFlags(user: ResolvedUser, commits: NormalizedActivity[], pullRequests: NormalizedActivity[]) {
  const flags: string[] = [];
  if (user.userKey === UNKNOWN_USER_KEY) {
    flags.push("contains_unmapped_identity");
  }
  if (!user.githubLogin && commits.length + pullRequests.length > 0) {
    flags.push("missing_github_login_mapping");
  }
  return flags;
}

function collectPresentUsers(
  users: ReturnType<typeof buildUserDirectory>,
  workItems: NormalizedWorkItem[],
  activities: NormalizedActivity[]
) {
  const userKeys = new Set<string>();
  for (const item of workItems) {
    userKeys.add(item.userKey);
  }
  for (const activity of activities) {
    userKeys.add(activity.userKey);
  }

  return [...userKeys]
    .map((key) => users.byId.get(key) ?? users.byLogin.get(key) ?? users.byName.get(key) ?? (key === UNKNOWN_USER_KEY ? unknownUser() : undefined))
    .filter((user): user is ResolvedUser => Boolean(user))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function buildDatasetRepos(activities: NormalizedActivity[]): AnalyticsDatasetRepo[] {
  const repos = new Map<string, AnalyticsDatasetRepo>();
  for (const activity of activities) {
    repos.set(activity.repoId, {
      repoId: activity.repoId,
      repoName: activity.repoName,
      fullName: activity.repoFullName
    });
  }
  return [...repos.values()].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function buildDoraInstrumentation(): DoraInstrumentationStatus {
  const metrics: DoraInstrumentationStatus["metrics"] = [
    {
      key: "change_lead_time",
      label: "Change lead time",
      status: "not_instrumented",
      reason: "Current analytics stop before a successful production deployment event.",
      requiredSources: ["deployment events"]
    },
    {
      key: "deployment_frequency",
      label: "Deployment frequency",
      status: "not_instrumented",
      reason: "The system does not yet persist production deployment events per service.",
      requiredSources: ["deployment events"]
    },
    {
      key: "failed_deployment_recovery_time",
      label: "Failed deployment recovery time",
      status: "not_instrumented",
      reason: "Recovery timestamps for deployment-caused incidents are not captured.",
      requiredSources: ["production failure / rollback events", "incident recovery timestamps"]
    },
    {
      key: "change_fail_rate",
      label: "Change fail rate",
      status: "not_instrumented",
      reason: "Production failures are not linked back to deployments in the current model.",
      requiredSources: ["production failure / rollback events", "deployment events"]
    },
    {
      key: "deployment_rework_rate",
      label: "Deployment rework rate",
      status: "not_instrumented",
      reason: "Unplanned fix deployments are not explicitly tracked today.",
      requiredSources: ["deployment events", "unplanned fix deployments"]
    }
  ];

  return {
    note: "DORA metrics are intended for application or service-level improvement over time, not for individual ranking.",
    metrics
  };
}

function resolveActivityUser(
  activity: RawActivity,
  users: ReturnType<typeof buildUserDirectory>,
  cardsById: Map<string, RawCard>
) {
  if (activity.authorLogin) {
    const byLogin = users.byLogin.get(normalizeText(activity.authorLogin));
    if (byLogin) {
      return byLogin;
    }
  }

  const linkedOwners = new Set<string>();
  for (const cardId of activity.linkedCardIds) {
    const card = cardsById.get(cardId);
    const ownerId = card?.assigneeAppUserId ?? card?.importedByAppUserId;
    if (ownerId) {
      linkedOwners.add(ownerId);
    }
  }
  if (linkedOwners.size === 1) {
    const onlyOwner = [...linkedOwners][0]!;
    const byId = users.byId.get(onlyOwner);
    if (byId) {
      return byId;
    }
  }

  const byName = users.byName.get(normalizeText(activity.authorName));
  if (byName) {
    return byName;
  }

  return unknownUser();
}

function determineCompletedAt(card: RawCard) {
  const completedEvent = [...card.statusEvents]
    .filter((event) => event.toStatus === "done")
    .sort((left, right) => right.changedAt.getTime() - left.changedAt.getTime())[0];

  if (completedEvent) {
    return completedEvent.changedAt;
  }

  return card.statusKey === "done" ? card.updatedAt : undefined;
}

function countStatusesAt(workItems: NormalizedWorkItem[], date: Date) {
  const counts = {
    backlog: 0,
    notStarted: 0,
    active: 0,
    review: 0,
    done: 0
  };

  for (const item of workItems) {
    if (item.createdAt > date) {
      continue;
    }
    const current = stateAt(item, date);
    if (current === "done") {
      counts.done += 1;
    } else if (current === "review") {
      counts.review += 1;
    } else if (current === "active") {
      counts.active += 1;
    } else if (current === "backlog") {
      counts.backlog += 1;
    } else {
      counts.notStarted += 1;
    }
  }

  return counts;
}

function stateAt(item: NormalizedWorkItem, date: Date) {
  const event = [...item.statusEvents]
    .filter((statusEvent) => statusEvent.changedAt <= date)
    .sort((left, right) => right.changedAt.getTime() - left.changedAt.getTime())[0];

  return event?.toStatus ?? item.statusKey;
}

function buildWeekBuckets(now: Date, weeks: number): WeekBucket[] {
  const currentWeekStart = startOfUtcWeek(now);
  const firstWeekStart = new Date(currentWeekStart);
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - (weeks - 1) * 7);

  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = new Date(firstWeekStart);
    weekStart.setUTCDate(firstWeekStart.getUTCDate() + index * 7);
    const weekEnd = endOfUtcWeek(weekStart);

    return {
      label: formatWeekLabel(weekStart, weekEnd),
      weekStart,
      weekEnd
    };
  });
}

function startOfUtcWeek(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function endOfUtcWeek(value: Date) {
  const start = startOfUtcWeek(value);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function formatWeekLabel(start: Date, end: Date) {
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

function classifyFeature(parts: string[]) {
  const haystack = normalizeText(parts.join(" "));
  for (const rule of FEATURE_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(normalizeText(keyword)))) {
      return rule.feature;
    }
  }
  return "General / Other";
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function unknownUser(): ResolvedUser {
  return {
    userKey: UNKNOWN_USER_KEY,
    displayName: UNKNOWN_USER_NAME
  };
}

function isWithinWindow(value: Date, start: Date, end: Date) {
  return value >= start && value <= end;
}

function isReopenedTransition(event: RawCardStatusEvent) {
  const from = event.fromStatus ?? "";
  return ["done", "review"].includes(from) && ["active", "not_started", "backlog"].includes(event.toStatus);
}

function isLikelyMergeCommit(title: string) {
  const normalized = title.trim().toLowerCase();
  return normalized.startsWith("merge ");
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return sum(values) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function percentile(values: number[], target: number) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((target / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function roundNumber(value: number) {
  return Number(value.toFixed(1));
}

function safePercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return roundNumber((numerator / denominator) * 100);
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}
