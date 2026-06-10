import type {
  RepositoryCommitNode,
  RepositoryCommitSearchItem
} from "@emergence-devops/shared";

const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

export function normalizeCommitSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

export function isLikelyCommitSha(query: string) {
  const normalized = normalizeCommitSearchQuery(query);
  if (!normalized) {
    return false;
  }

  const withoutCaret = normalized.startsWith("^") ? normalized.slice(1) : normalized;
  return SHA_PATTERN.test(withoutCaret);
}

export function commitShaCandidates(query: string) {
  const normalized = normalizeCommitSearchQuery(query);
  if (!normalized) {
    return [];
  }

  const withoutCaret = normalized.startsWith("^") ? normalized.slice(1) : normalized;
  return SHA_PATTERN.test(withoutCaret) ? [withoutCaret] : [];
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function tokenOverlapScore(query: string, haystack: string) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return 0;
  }

  const haystackTokens = new Set(tokenize(haystack));
  const matched = queryTokens.filter((token) => haystackTokens.has(token)).length;
  return Math.round((matched / queryTokens.length) * 120);
}

function describeCommitMatch(query: string, commit: RepositoryCommitNode, score: number): string {
  const normalizedQuery = normalizeCommitSearchQuery(query);
  const shaQuery = commitShaCandidates(query)[0] ?? normalizedQuery;

  if (commit.sha.toLowerCase() === shaQuery) {
    return "SHA";
  }

  if (commit.sha.toLowerCase().startsWith(shaQuery) || commit.shortSha.toLowerCase().startsWith(shaQuery)) {
    return "SHA prefix";
  }

  const headline = commit.messageHeadline.toLowerCase();
  const body = commit.messageBody.toLowerCase();
  if (headline.includes(normalizedQuery) || body.includes(normalizedQuery)) {
    return "Message";
  }

  const authorLogin = commit.authorLogin?.toLowerCase() ?? "";
  const authorName = commit.authorName.toLowerCase();
  if (authorLogin.includes(normalizedQuery) || authorName.includes(normalizedQuery)) {
    return "Author";
  }

  return score >= 80 ? "Similarity" : "Match";
}

export function scoreCommitSimilarity(query: string, commit: RepositoryCommitNode): number {
  const normalizedQuery = normalizeCommitSearchQuery(query);
  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;
  const shaQuery = commitShaCandidates(query)[0] ?? normalizedQuery;
  const commitSha = commit.sha.toLowerCase();
  const shortSha = commit.shortSha.toLowerCase();

  if (commitSha === shaQuery) {
    score += 1000;
  } else if (commitSha.startsWith(shaQuery) || shortSha.startsWith(shaQuery)) {
    score += 850 - Math.min(shaQuery.length, 20);
  }

  const headline = commit.messageHeadline.toLowerCase();
  const body = commit.messageBody.toLowerCase();
  if (headline === normalizedQuery) {
    score += 700;
  } else if (headline.includes(normalizedQuery)) {
    score += 520;
  } else if (body.includes(normalizedQuery)) {
    score += 420;
  }

  const authorLogin = commit.authorLogin?.toLowerCase() ?? "";
  const authorName = commit.authorName.toLowerCase();
  if (authorLogin === normalizedQuery || authorName === normalizedQuery) {
    score += 360;
  } else if (authorLogin.includes(normalizedQuery) || authorName.includes(normalizedQuery)) {
    score += 280;
  }

  score += tokenOverlapScore(
    normalizedQuery,
    [commit.messageHeadline, commit.messageBody, commit.authorLogin, commit.authorName].filter(Boolean).join(" ")
  );

  return score;
}

export function rankCommitMatches(
  query: string,
  commits: RepositoryCommitNode[],
  limit = 7
): RepositoryCommitSearchItem[] {
  const deduped = new Map<string, RepositoryCommitNode>();
  for (const commit of commits) {
    deduped.set(commit.sha, commit);
  }

  const ranked = Array.from(deduped.values())
    .map((commit) => {
      const score = scoreCommitSimilarity(query, commit);
      return {
        commit,
        score,
        matchLabel: describeCommitMatch(query, commit, score)
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return Date.parse(right.commit.committedAt) - Date.parse(left.commit.committedAt);
    });

  return ranked.slice(0, limit);
}

type RestCommitLike = {
  sha: string;
  html_url: string;
  commit: {
    message?: string | null;
    author?: { name?: string | null; date?: string | null } | null;
    committer?: { date?: string | null } | null;
  };
  author?: { login?: string | null; avatar_url?: string | null } | null;
  parents?: Array<{ sha?: string }>;
  stats?: {
    additions?: number | null;
    deletions?: number | null;
    total?: number | null;
  } | null;
};

export function mapRestCommitToRepositoryCommitNode(commit: RestCommitLike): RepositoryCommitNode {
  const message = String(commit.commit.message ?? "");
  const [messageHeadline, ...bodyLines] = message.split("\n");

  return {
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    messageHeadline: messageHeadline?.trim() || commit.sha.slice(0, 7),
    messageBody: bodyLines.join("\n").trim(),
    authorName: commit.commit.author?.name ?? commit.author?.login ?? "Unknown author",
    authorLogin: commit.author?.login ?? undefined,
    authorAvatarUrl: commit.author?.avatar_url ?? undefined,
    committedAt: commit.commit.committer?.date ?? commit.commit.author?.date ?? new Date().toISOString(),
    authoredAt: commit.commit.author?.date ?? commit.commit.committer?.date ?? new Date().toISOString(),
    parentShas: commit.parents?.map((parent) => parent.sha).filter((sha): sha is string => Boolean(sha)) ?? [],
    branchHeadNames: [],
    additions: commit.stats?.additions ?? 0,
    deletions: commit.stats?.deletions ?? 0,
    changedFiles: commit.stats?.total ?? 0,
    htmlUrl: commit.html_url,
    taggedTaskCount: 0,
    taggedTasksPreview: []
  };
}
