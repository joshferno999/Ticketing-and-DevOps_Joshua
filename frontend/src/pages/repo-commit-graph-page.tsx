import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type {
  CommitTaskLinksResponse,
  RepositoryCommitGraphResponse,
  RepositoryCommitNode,
  RepositoryPullRequestListResponse,
  RepositoryPullRequestSummary,
  PullRequestTaskLinksResponse
} from "@emergence-devops/shared";
import type { SvgNodePrimitive, SvgPathPrimitive } from "graph-lab";
import { api, ApiError } from "../lib/api";
import { CommitSearchBar } from "../components/github/commit-search-bar";
import { InlineLoadingHint, LoadingDots } from "../components/ui/loading";
import { TaskTagEditor } from "../components/github/task-tag-editor";
import {
  buildRepositoryGraphModel,
  COMMIT_GRAPH_HEADER_HEIGHT,
  COMMIT_GRAPH_ROW_HEIGHT
} from "../lib/repository-graph-layout";

const BRANCH_PILL_COLORS = [
  "bg-primary-fixed text-on-primary-fixed-variant border-primary-fixed-dim",
  "bg-success-muted text-success border-success/30",
  "bg-tertiary-container text-on-tertiary-container border-tertiary-fixed-dim",
  "bg-error-container text-on-error-container border-error/30",
  "bg-surface-container-high text-on-surface-variant border-outline-variant",
  "bg-surface-container-low text-primary border-primary-fixed-dim"
];

const GRAPH_TABLE_COLUMNS = "132px 520px 220px 176px 148px 88px";
const GRAPH_TABLE_MIN_WIDTH = 132 + 520 + 220 + 176 + 148 + 88 + 80 + 40;
const COMMIT_GRAPH_PAGE_SIZE = 60;
const PULL_REQUEST_PAGE_SIZE = 20;

export function RepoCommitGraphPage() {
  const { repositoryId } = useParams<{ repositoryId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<RepositoryCommitGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [githubAccessRequired, setGithubAccessRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [inspectedCommit, setInspectedCommit] = useState<RepositoryCommitNode | null>(null);
  const [commitTaskLinksBySha, setCommitTaskLinksBySha] = useState<Record<string, CommitTaskLinksResponse | null>>({});
  const [commitTaskLinksLoadingSha, setCommitTaskLinksLoadingSha] = useState<string | null>(null);
  const [commitTaskLinksSavingSha, setCommitTaskLinksSavingSha] = useState<string | null>(null);
  const [commitTaskLinksErrorBySha, setCommitTaskLinksErrorBySha] = useState<Record<string, string | null>>({});
  const [pullRequestsOpen, setPullRequestsOpen] = useState(false);
  const [pullRequests, setPullRequests] = useState<RepositoryPullRequestSummary[]>([]);
  const [pullRequestsLoading, setPullRequestsLoading] = useState(false);
  const [pullRequestsLoadingMore, setPullRequestsLoadingMore] = useState(false);
  const [pullRequestsError, setPullRequestsError] = useState<string | null>(null);
  const [pullRequestsPageInfo, setPullRequestsPageInfo] = useState<RepositoryPullRequestListResponse["pageInfo"] | null>(null);
  const [expandedPullRequestNumber, setExpandedPullRequestNumber] = useState<number | null>(null);
  const [pullRequestTaskLinks, setPullRequestTaskLinks] = useState<Record<number, PullRequestTaskLinksResponse | null>>({});
  const [pullRequestTaskLoadingNumber, setPullRequestTaskLoadingNumber] = useState<number | null>(null);
  const [pullRequestTaskSavingNumber, setPullRequestTaskSavingNumber] = useState<number | null>(null);
  const [pullRequestTaskErrorByNumber, setPullRequestTaskErrorByNumber] = useState<Record<number, string | null>>({});
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const commitRowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pullRequestsLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const pullRequestsScrollRef = useRef<HTMLDivElement | null>(null);

  const scope = searchParams.get("scope") === "branch" ? "branch" : "all";
  const selectedBranch = scope === "branch" ? searchParams.get("branch") ?? "" : "";

  useEffect(() => {
    if (!repositoryId) {
      return;
    }

    setData(null);
    setInspectedCommit(null);
    setCommitTaskLinksBySha({});
    setCommitTaskLinksErrorBySha({});
    setCommitTaskLinksLoadingSha(null);
    setCommitTaskLinksSavingSha(null);
    void loadCommitGraph({ silent: false, append: false });
  }, [repositoryId, scope, selectedBranch]);

  useEffect(() => {
    if (!selectedSha) {
      setMobileInspectorOpen(false);
    }
  }, [selectedSha]);

  useEffect(() => {
    if (!data?.commits.length) {
      if (!inspectedCommit) {
        setSelectedSha(null);
      }
      return;
    }

    setSelectedSha((current) => {
      if (
        current
        && (data.commits.some((commit) => commit.sha === current) || inspectedCommit?.sha === current)
      ) {
        return current;
      }

      return data.commits[0]!.sha;
    });
  }, [data, inspectedCommit?.sha]);

  useEffect(() => {
    if (!repositoryId || !selectedSha) {
      setCommitTaskLinksLoadingSha(null);
      return;
    }

    const sha = selectedSha;
    let active = true;
    setCommitTaskLinksLoadingSha(sha);
    setCommitTaskLinksErrorBySha((current) => ({ ...current, [sha]: null }));
    void api.getCommitTaskLinks(repositoryId, sha)
      .then((payload) => {
        if (active) {
          setCommitTaskLinksBySha((current) => ({ ...current, [sha]: payload }));
        }
      })
      .catch((cause) => {
        if (active) {
          setCommitTaskLinksErrorBySha((current) => ({
            ...current,
            [sha]: cause instanceof ApiError ? cause.message : "Tagged tasks could not be loaded."
          }));
        }
      })
      .finally(() => {
        if (active) {
          setCommitTaskLinksLoadingSha((current) => current === sha ? null : current);
        }
      });

    return () => {
      active = false;
    };
  }, [repositoryId, selectedSha]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !data?.pageInfo.hasMore || loading || loadingMore || refreshing) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void loadCommitGraph({ silent: true, append: true });
        }
      },
      {
        rootMargin: "220px 0px"
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [data?.pageInfo.hasMore, loading, loadingMore, refreshing, repositoryId, scope, selectedBranch]);

  useEffect(() => {
    const target = pullRequestsLoadMoreRef.current;
    const root = pullRequestsScrollRef.current;
    if (
      !pullRequestsOpen ||
      !target ||
      !root ||
      !pullRequestsPageInfo?.hasMore ||
      pullRequestsLoading ||
      pullRequestsLoadingMore
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void loadPullRequests({ append: true });
        }
      },
      {
        root,
        rootMargin: "180px 0px"
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [pullRequestsOpen, pullRequestsPageInfo?.hasMore, pullRequestsLoading, pullRequestsLoadingMore]);

  async function loadCommitGraph(options: { silent: boolean; append: boolean }) {
    if (!repositoryId) {
      return;
    }

    if (options.append) {
      if (!data?.pageInfo.hasMore || loadingMore) {
        return;
      }
      setLoadingMore(true);
    } else if (options.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    if (!options.append) {
      setError(null);
      setGithubAccessRequired(false);
    }

    try {
      const nextData = await api.getRepositoryCommitGraph(repositoryId, {
        scope,
        branch: scope === "branch" ? selectedBranch : undefined,
        offset: options.append ? data?.pageInfo.nextOffset ?? data?.commits.length ?? 0 : 0,
        limit: COMMIT_GRAPH_PAGE_SIZE
      });
      setData((current) => {
        if (!options.append || !current) {
          return nextData;
        }

        const seen = new Set(current.commits.map((commit) => commit.sha));
        const mergedCommits = [
          ...current.commits,
          ...nextData.commits.filter((commit) => !seen.has(commit.sha))
        ];

        return {
          ...nextData,
          commits: mergedCommits
        };
      });
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
        setGithubAccessRequired(cause.status === 403);
      } else {
        setError("The repository commit graph could not be loaded.");
        setGithubAccessRequired(false);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  async function loadPullRequests(options: { append: boolean }) {
    if (!repositoryId) {
      return;
    }
    if (options.append) {
      if (!pullRequestsPageInfo?.hasMore || pullRequestsLoadingMore) {
        return;
      }
      setPullRequestsLoadingMore(true);
    } else {
      setPullRequestsLoading(true);
      setPullRequestsError(null);
    }

    try {
      const payload = await api.getRepositoryPullRequests(repositoryId, {
        offset: options.append ? pullRequestsPageInfo?.nextOffset ?? pullRequests.length : 0,
        limit: PULL_REQUEST_PAGE_SIZE
      });

      setPullRequests((current) => {
        if (!options.append) {
          return payload.pullRequests;
        }

        const seen = new Set(current.map((pullRequest) => pullRequest.id));
        return [...current, ...payload.pullRequests.filter((pullRequest) => !seen.has(pullRequest.id))];
      });
      setPullRequestsPageInfo(payload.pageInfo);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setPullRequestsError(cause.message);
      } else {
        setPullRequestsError("Pull requests could not be loaded.");
      }
    } finally {
      setPullRequestsLoading(false);
      setPullRequestsLoadingMore(false);
    }
  }

  async function openPullRequests() {
    setPullRequestsOpen(true);
    setPullRequests([]);
    setPullRequestsPageInfo(null);
    setExpandedPullRequestNumber(null);
    setPullRequestTaskLinks({});
    setPullRequestTaskErrorByNumber({});
    void loadPullRequests({ append: false });
  }

  async function saveSelectedCommitTaskLinks(cardIds: string[]) {
    if (!repositoryId || !selectedSha) {
      return;
    }

    const sha = selectedSha;
    setCommitTaskLinksSavingSha(sha);
    setCommitTaskLinksErrorBySha((current) => ({ ...current, [sha]: null }));
    try {
      const payload = await api.saveCommitTaskLinks(repositoryId, sha, cardIds);
      setCommitTaskLinksBySha((current) => ({ ...current, [sha]: payload }));
      setData((current) => current ? {
        ...current,
        commits: current.commits.map((commit) => (
          commit.sha === sha
            ? {
                ...commit,
                taggedTaskCount: payload.activity.taggedTaskCount,
                taggedTasksPreview: payload.activity.taggedTasksPreview
              }
            : commit
        ))
      } : current);
    } finally {
      setCommitTaskLinksSavingSha((current) => current === sha ? null : current);
    }
  }

  async function togglePullRequestTaskEditor(pullRequestNumber: number) {
    if (!repositoryId) {
      return;
    }

    if (expandedPullRequestNumber === pullRequestNumber) {
      setExpandedPullRequestNumber(null);
      return;
    }

    setExpandedPullRequestNumber(pullRequestNumber);
    if (pullRequestTaskLinks[pullRequestNumber]) {
      return;
    }

    setPullRequestTaskLoadingNumber(pullRequestNumber);
    setPullRequestTaskErrorByNumber((current) => ({ ...current, [pullRequestNumber]: null }));
    try {
      const payload = await api.getPullRequestTaskLinks(repositoryId, pullRequestNumber);
      setPullRequestTaskLinks((current) => ({
        ...current,
        [pullRequestNumber]: payload
      }));
    } catch (cause) {
      setPullRequestTaskErrorByNumber((current) => ({
        ...current,
        [pullRequestNumber]: cause instanceof ApiError ? cause.message : "Pull request tasks could not be loaded."
      }));
    } finally {
      setPullRequestTaskLoadingNumber((current) => current === pullRequestNumber ? null : current);
    }
  }

  async function savePullRequestTaskLinks(pullRequestNumber: number, cardIds: string[]) {
    if (!repositoryId) {
      return;
    }

    setPullRequestTaskSavingNumber(pullRequestNumber);
    setPullRequestTaskErrorByNumber((current) => ({ ...current, [pullRequestNumber]: null }));
    try {
      const payload = await api.savePullRequestTaskLinks(repositoryId, pullRequestNumber, cardIds);
      setPullRequestTaskLinks((current) => ({
        ...current,
        [pullRequestNumber]: payload
      }));
      setPullRequests((current) => current.map((pullRequest) => (
        pullRequest.number === pullRequestNumber
          ? {
              ...pullRequest,
              taggedTaskCount: payload.activity.taggedTaskCount,
              taggedTasksPreview: payload.activity.taggedTasksPreview
            }
          : pullRequest
      )));
    } finally {
      setPullRequestTaskSavingNumber((current) => current === pullRequestNumber ? null : current);
    }
  }

  function scrollToCommitRow(sha: string) {
    window.requestAnimationFrame(() => {
      commitRowRefs.current[sha]?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  async function handleCommitSearchSelect(commit: RepositoryCommitNode) {
    if (!repositoryId) {
      return;
    }

    setSelectedSha(commit.sha);
    setMobileInspectorOpen(true);
    const existsInGraph = data?.commits.some((item) => item.sha === commit.sha) ?? false;

    if (existsInGraph) {
      setInspectedCommit(null);
      scrollToCommitRow(commit.sha);
      return;
    }

    try {
      const resolvedCommit = await api.getRepositoryCommit(repositoryId, commit.sha);
      setInspectedCommit(resolvedCommit);
    } catch {
      setInspectedCommit(commit);
    }
  }

  function selectCommitFromGraph(sha: string) {
    setInspectedCommit(null);
    setSelectedSha(sha);
    setMobileInspectorOpen(true);
  }

  function updateScope(nextScope: "all" | "branch", branchName?: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("scope", nextScope);
    if (nextScope === "branch" && branchName) {
      nextParams.set("branch", branchName);
    } else {
      nextParams.delete("branch");
    }
    setSearchParams(nextParams, { replace: true });
  }

  const selectedCommit =
    data?.commits.find((commit) => commit.sha === selectedSha)
    ?? (inspectedCommit?.sha === selectedSha ? inspectedCommit : null);
  const selectedCommitTaskLinks = selectedSha ? commitTaskLinksBySha[selectedSha] ?? null : null;
  const selectedCommitTaskLinksLoading = Boolean(selectedSha && commitTaskLinksLoadingSha === selectedSha);
  const selectedCommitTaskLinksSaving = Boolean(selectedSha && commitTaskLinksSavingSha === selectedSha);
  const selectedCommitTaskLinksError = selectedSha ? commitTaskLinksErrorBySha[selectedSha] ?? null : null;
  const selectedCommitOutsideGraph = Boolean(
    selectedCommit && !(data?.commits.some((commit) => commit.sha === selectedCommit.sha))
  );
  const currentBranchName = scope === "branch" ? selectedBranch || data?.repo.defaultBranch || "" : data?.repo.defaultBranch || "";
  const graphModel = useMemo(
    () => (data ? buildRepositoryGraphModel(data, currentBranchName) : null),
    [data, currentBranchName]
  );
  const selectedRowIndex = useMemo(
    () => data?.commits.findIndex((commit) => commit.sha === selectedSha) ?? -1,
    [data?.commits, selectedSha]
  );

  if (!repositoryId) {
    return (
      <div className="flex h-full items-center justify-center p-margin">
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin text-center shadow-[var(--shadow-panel)]">
          <h1 className="font-headline-md text-headline-md text-on-surface">Repository unavailable</h1>
          <p className="mt-2 max-w-md text-body-md text-on-surface-variant">
            {error ?? "This repository is no longer granted to the workspace or its history could not be loaded."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {githubAccessRequired ? (
              <Link className="inline-flex rounded-xl border border-transparent bg-primary-container px-4 py-2 font-label-md text-label-md text-on-primary hover:bg-inverse-surface" to="/settings?section=github">
                Connect GitHub
              </Link>
            ) : null}
            <Link className="inline-flex rounded-xl border border-outline-variant bg-surface px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-low" to="/repos">
              Back to repositories
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background-alt">
        <div className="border-b border-outline-variant bg-surface px-gutter py-2">
          <Link className="inline-flex h-8 items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-2.5 text-label-sm text-on-surface-variant" to="/repos">
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            Repos
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <InlineLoadingHint label="Loading repository graph" />
        </div>
      </div>
    );
  }

  if (!data || !graphModel) {
    return (
      <div className="flex h-full items-center justify-center p-margin">
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin text-center shadow-[var(--shadow-panel)]">
          <h1 className="font-headline-md text-headline-md text-on-surface">Repository unavailable</h1>
          <p className="mt-2 max-w-md text-body-md text-on-surface-variant">
            {error ?? "This repository is no longer granted to the workspace or its history could not be loaded."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {githubAccessRequired ? (
              <Link className="inline-flex rounded-xl border border-transparent bg-primary-container px-4 py-2 font-label-md text-label-md text-on-primary hover:bg-inverse-surface" to="/settings?section=github">
                Connect GitHub
              </Link>
            ) : null}
            <Link className="inline-flex rounded-xl border border-outline-variant bg-surface px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-low" to="/repos">
              Back to repositories
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const graphRailWidth = Math.ceil(graphModel.svg.graphWidth) + 28;
  const graphBodyHeight = graphModel.svg.totalHeight;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background-alt">
      {loading ? (
        <div className="pointer-events-none absolute left-4 top-[4.5rem] z-20 inline-flex items-center gap-2 rounded-full border border-outline-variant/80 bg-surface/90 px-2.5 py-1 text-label-sm text-on-surface-variant shadow-[var(--shadow-popover)] backdrop-blur-xl">
          <LoadingDots tone="muted" />
          <span>Loading graph</span>
        </div>
      ) : null}
      <div className="border-b border-outline-variant bg-surface/90 px-3 py-3 shadow-[0_1px_0_color-mix(in_oklch,var(--color-ink)_4%,transparent)] backdrop-blur-xl sm:px-gutter sm:py-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-2.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-low sm:h-8"
              to="/repos"
            >
              <span className="material-symbols-outlined text-[15px]">arrow_back</span>
              Repos
            </Link>
            <h1
              className="min-w-0 break-all font-headline-sm text-headline-sm font-semibold text-on-surface sm:whitespace-nowrap"
              title={data.repo.fullName}
            >
              {data.repo.fullName}
            </h1>
            <a
              className="inline-flex h-9 shrink-0 items-center rounded-xl border border-outline-variant bg-surface-container-lowest px-2.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-low sm:h-8"
              href={data.repo.htmlUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open on GitHub
            </a>
            <button
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-2.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-low sm:h-8"
              onClick={() => void openPullRequests()}
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">merge</span>
              Pull requests
            </button>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0">
            <CommitSearchBar repositoryId={repositoryId} onSelect={(commit) => void handleCommitSearchSelect(commit)} />
            <select
              className="h-10 min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-2.5 text-label-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] sm:h-8 sm:min-w-[140px] sm:max-w-[200px]"
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === "__all__") {
                  updateScope("all");
                  return;
                }
                updateScope("branch", nextValue);
              }}
              value={scope === "all" ? "__all__" : selectedBranch}
            >
              <option value="__all__">All branches</option>
              {data.branchOptions.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                  {branch.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
            <button
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-2.5 font-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-70 sm:h-8"
              disabled={refreshing}
              onClick={() => void loadCommitGraph({ silent: true, append: false })}
              type="button"
            >
              <span className={`material-symbols-outlined text-[15px] ${refreshing ? "animate-spin" : ""}`}>refresh</span>
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="border-b border-error bg-error-container px-gutter py-stack-sm text-body-md text-on-error-container">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-outline-variant bg-surface-container-lowest xl:border-b-0 xl:border-r">
          {data.commits.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-margin text-body-md text-on-surface-variant">
              No commits were returned for this repository scope.
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-outline-variant bg-surface-container-high px-3 py-2.5 sm:px-4">
                <div className="font-label-md uppercase tracking-[0.08em] leading-5 text-on-surface-variant">Commit Graph</div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-label-sm leading-5 text-on-surface-variant">
                    {data.pageInfo.totalCommits === null
                      ? `${data.commits.length} loaded`
                      : `${data.commits.length}/${data.pageInfo.totalCommits} commits`}
                  </div>
                  {selectedCommit ? (
                    <button
                      className="inline-flex h-8 items-center rounded border border-outline-variant bg-surface px-2.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-low xl:hidden"
                      onClick={() => setMobileInspectorOpen(true)}
                      type="button"
                    >
                      Inspect
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <div className="min-w-max">
                  <div className="sticky top-0 z-20 flex border-b border-outline-variant bg-surface-container-lowest">
                    <div
                      className="shrink-0 border-r border-outline-variant bg-primary-fixed/30"
                      style={{ width: graphRailWidth, height: COMMIT_GRAPH_HEADER_HEIGHT }}
                    />
                    <div
                      className="grid items-center gap-4 px-5 text-label-sm uppercase tracking-[0.08em] text-on-surface-variant"
                      style={{
                        height: COMMIT_GRAPH_HEADER_HEIGHT,
                        minWidth: GRAPH_TABLE_MIN_WIDTH,
                        gridTemplateColumns: GRAPH_TABLE_COLUMNS
                      }}
                    >
                      <div>Refs</div>
                      <div>Commit</div>
                      <div>Author</div>
                      <div>Changes</div>
                      <div>Date</div>
                      <div className="text-right">SHA</div>
                    </div>
                  </div>

                  <div className="flex">
                    <div
                      className="relative shrink-0 overflow-hidden border-r border-outline-variant"
                      style={{
                        width: graphRailWidth,
                        height: graphBodyHeight,
                        backgroundImage: `linear-gradient(180deg, color-mix(in oklch, var(--color-accent-soft) 42%, transparent), color-mix(in oklch, var(--color-accent-soft) 12%, transparent)), repeating-linear-gradient(to bottom, transparent 0, transparent ${COMMIT_GRAPH_ROW_HEIGHT - 1}px, var(--color-rule) ${COMMIT_GRAPH_ROW_HEIGHT - 1}px, var(--color-rule) ${COMMIT_GRAPH_ROW_HEIGHT}px)`
                      }}
                    >
                      {selectedRowIndex >= 0 ? (
                        <div
                          className="pointer-events-none absolute left-0 right-0 bg-primary-fixed/70"
                          style={{
                            top: selectedRowIndex * COMMIT_GRAPH_ROW_HEIGHT,
                            height: COMMIT_GRAPH_ROW_HEIGHT
                          }}
                        />
                      ) : null}

                      <svg
                        aria-hidden="true"
                        className="block"
                        height={graphModel.svg.totalHeight}
                        style={{ marginLeft: 14, marginTop: 0 }}
                        viewBox={`0 0 ${graphModel.svg.graphWidth} ${graphModel.svg.totalHeight}`}
                        width={graphModel.svg.graphWidth}
                      >
                        <g
                          transform={`translate(0 ${graphModel.svg.totalHeight - COMMIT_GRAPH_ROW_HEIGHT / 2}) scale(1 -1)`}
                        >
                          {graphModel.svg.rails.map((path, index) => (
                            <GraphPath key={`rail-${index}`} path={path} />
                          ))}
                          {graphModel.svg.connectors.map((path, index) => (
                            <GraphPath key={`connector-${index}`} path={path} />
                          ))}
                          {graphModel.svg.nodes.map((node, index) => (
                            <g
                              key={data.commits[index]?.sha ?? `node-${index}`}
                              className="cursor-pointer"
                              onClick={() => {
                                const commit = data.commits[index];
                                if (commit) {
                                  selectCommitFromGraph(commit.sha);
                                }
                              }}
                            >
                              <GraphNode node={node} />
                            </g>
                          ))}
                        </g>
                      </svg>
                    </div>

                    <div className="bg-surface-container-lowest" style={{ minWidth: GRAPH_TABLE_MIN_WIDTH }}>
                      {data.commits.map((commit) => {
                        const isSelected = selectedSha === commit.sha;
                        const refNames = commit.branchHeadNames.slice(0, 2);
                        const remainingRefs = Math.max(0, commit.branchHeadNames.length - refNames.length);

                        return (
                          <button
                            key={commit.sha}
                            ref={(element) => {
                              commitRowRefs.current[commit.sha] = element;
                            }}
                            className={`grid h-12 items-center gap-4 overflow-hidden border-b border-outline-variant px-5 text-left transition-colors ${isSelected ? "bg-primary-fixed/70" : "bg-surface-container-lowest hover:bg-surface-container-low"}`}
                            onClick={() => selectCommitFromGraph(commit.sha)}
                            style={{
                              minWidth: GRAPH_TABLE_MIN_WIDTH,
                              gridTemplateColumns: GRAPH_TABLE_COLUMNS
                            }}
                            type="button"
                          >
                            <div className="min-w-0">
                              {refNames.length > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  {refNames.map((branchName) => (
                                    <span
                                      key={`${commit.sha}-${branchName}`}
                                      className={`inline-flex max-w-[96px] items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4 ${branchPillClass(branchName)}`}
                                      title={branchName}
                                    >
                                      <span className="truncate">{branchName}</span>
                                    </span>
                                  ))}
                                  {remainingRefs > 0 ? (
                                    <span className="rounded-full border border-outline-variant bg-surface px-1.5 py-0.5 text-[10px] leading-4 text-on-surface-variant">
                                      +{remainingRefs}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>

                            <div className="min-w-0 self-center">
                              <div className="truncate text-body-md font-semibold text-on-surface">{commit.messageHeadline}</div>
                              <div className="truncate text-[11px] leading-4 text-on-surface-variant">
                                {commit.pullRequest
                                  ? `PR #${commit.pullRequest.number} · ${commit.pullRequest.title}`
                                  : commit.messageBody || commit.authorLogin || "No additional commit context"}
                                {commit.taggedTaskCount > 0 ? ` · ${commit.taggedTaskCount} task${commit.taggedTaskCount === 1 ? "" : "s"}` : ""}
                              </div>
                            </div>

                            <div className="min-w-0 self-center truncate text-body-md text-on-surface-variant">
                              {commit.authorLogin ?? commit.authorName}
                            </div>

                            <div className="min-w-0 self-center">
                              <div className="text-body-md text-on-surface">{commit.changedFiles}</div>
                              <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                                <div
                                  className="bg-success"
                                  style={{ width: `${diffBarWidth(commit.additions, commit.deletions, "additions")}%` }}
                                />
                                <div
                                  className="bg-error"
                                  style={{ width: `${diffBarWidth(commit.additions, commit.deletions, "deletions")}%` }}
                                />
                              </div>
                            </div>

                            <div className="self-center truncate text-body-md text-on-surface-variant">
                              {formatCommitDate(commit.committedAt)}
                            </div>

                            <div className="self-center text-right font-label-md text-label-md text-on-surface-variant">
                              {commit.shortSha}
                            </div>
                          </button>
                        );
                      })}

                      <div ref={loadMoreRef} />

                      {loadingMore ? (
                        <div className="flex items-center justify-center gap-2 border-b border-outline-variant px-5 py-4 text-label-sm text-on-surface-variant">
                          <span className="inline-flex gap-1">
                            <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:-0.2s]" />
                            <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:-0.05s]" />
                            <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:0.1s]" />
                          </span>
                          <span>Loading more commits</span>
                        </div>
                      ) : null}

                      {!data.pageInfo.hasMore && data.commits.length > 0 ? (
                        <div className="border-b border-outline-variant px-5 py-4 text-center text-label-sm text-on-surface-variant">
                          End of commit history
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="hidden w-full shrink-0 flex-col bg-surface xl:flex xl:w-[400px]">
          <div className="border-b border-outline-variant px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-label-md uppercase tracking-[0.08em] leading-5 text-on-surface-variant">Commit Graph Inspect</div>
                <div className="mt-0.5 font-headline-sm leading-7 text-headline-sm text-on-surface">
                  {selectedCommit ? selectedCommit.shortSha : "No commit selected"}
                </div>
              </div>
              {selectedCommit ? (
                <a
                  className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded border border-outline-variant bg-surface-container-lowest px-2.5 text-label-sm leading-none text-on-surface-variant transition-colors hover:bg-surface-container-low"
                  href={selectedCommit.htmlUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
            {selectedCommit ? (
              <div className="space-y-5">
                {selectedCommitOutsideGraph ? (
                  <div className="rounded-2xl border border-primary-fixed-dim bg-primary-fixed px-3 py-2 text-body-sm text-on-primary-fixed-variant">
                    Not in the current graph page. Task mapping is still available.
                  </div>
                ) : null}
                <section>
                  <div className="text-body-lg font-semibold text-on-surface">{selectedCommit.messageHeadline}</div>
                  {selectedCommit.messageBody ? (
                    <p className="mt-2 whitespace-pre-wrap text-body-md leading-6 text-on-surface-variant">{selectedCommit.messageBody}</p>
                  ) : null}
                </section>

                <section className="overflow-visible rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                    <InspectMetric
                      className="col-span-2"
                      label="Author"
                      value={selectedCommit.authorLogin ?? selectedCommit.authorName}
                    />
                    <InspectMetric label="Committed" value={formatInspectDate(selectedCommit.committedAt)} />
                    <InspectMetric label="Authored" value={formatInspectDate(selectedCommit.authoredAt)} />
                    <InspectMetric label="Changed files" value={String(selectedCommit.changedFiles)} />
                    <InspectMetric label="Additions" value={`+${selectedCommit.additions}`} />
                    <InspectMetric label="Deletions" value={`-${selectedCommit.deletions}`} />
                  </div>
                </section>

                <section>
                  <div className="font-label-md uppercase tracking-[0.08em] text-on-surface-variant">Parents</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCommit.parentShas.length > 0 ? (
                      selectedCommit.parentShas.map((parentSha) => (
                        <span key={parentSha} className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-label-sm text-on-surface-variant">
                          {parentSha.slice(0, 7)}
                        </span>
                      ))
                    ) : (
                      <span className="text-body-md text-on-surface-variant">Initial commit in current view</span>
                    )}
                  </div>
                </section>

                <section>
                  <div className="font-label-md uppercase tracking-[0.08em] text-on-surface-variant">Branch heads on this commit</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCommit.branchHeadNames.length > 0 ? (
                      selectedCommit.branchHeadNames.map((branchName) => (
                        <span key={branchName} className={`inline-flex rounded-full border px-2 py-0.5 text-label-sm ${branchPillClass(branchName)}`}>
                          {branchName}
                        </span>
                      ))
                    ) : (
                      <span className="text-body-md text-on-surface-variant">No included branch currently points to this commit.</span>
                    )}
                  </div>
                </section>

                {selectedCommit.pullRequest ? (
                  <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                    <div className="font-label-md uppercase tracking-[0.08em] text-on-surface-variant">Associated Pull Request</div>
                    <div className="mt-2 font-body-lg font-semibold text-on-surface">
                      #{selectedCommit.pullRequest.number} {selectedCommit.pullRequest.title}
                    </div>
                    <div className="mt-2 text-body-md text-on-surface-variant">State: {selectedCommit.pullRequest.state}</div>
                    <a
                      className="mt-3 inline-flex rounded border border-outline-variant bg-surface px-3 py-1.5 font-label-md text-label-md text-on-surface hover:bg-surface-container-low"
                      href={selectedCommit.pullRequest.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open pull request
                    </a>
                  </section>
                ) : null}

                <TaskTagEditor
                  activityKey={`commit:${selectedCommit.sha}`}
                  currentTasks={selectedCommitTaskLinks?.tasks ?? []}
                  error={selectedCommitTaskLinksError}
                  loading={selectedCommitTaskLinksLoading}
                  onSave={saveSelectedCommitTaskLinks}
                  repositoryId={repositoryId!}
                  saving={selectedCommitTaskLinksSaving}
                  saveLabel="Save commit tags"
                  title="Tagged tasks"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-margin text-body-md text-on-surface-variant">
                Select a commit to inspect its details.
              </div>
            )}
          </div>
        </aside>
      </div>

      {selectedCommit && mobileInspectorOpen ? (
        <div className="fixed inset-0 z-50 bg-[color-mix(in_oklch,var(--color-ink)_28%,transparent)] backdrop-blur-sm xl:hidden" onClick={() => setMobileInspectorOpen(false)}>
          <aside
            className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-hidden rounded-t-3xl border-t border-outline-variant bg-surface shadow-[var(--shadow-popover)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant px-4 py-3">
              <div className="min-w-0">
                <div className="font-label-md uppercase tracking-[0.08em] text-on-surface-variant">Commit Inspect</div>
                <div className="mt-1 truncate text-body-lg font-semibold text-on-surface">{selectedCommit.shortSha}</div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  className="inline-flex h-8 items-center rounded border border-outline-variant bg-surface-container-lowest px-2.5 text-label-sm text-on-surface-variant"
                  href={selectedCommit.htmlUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open
                </a>
                <button
                  className="inline-flex h-8 items-center rounded border border-outline-variant bg-surface px-2.5 text-label-sm text-on-surface-variant"
                  onClick={() => setMobileInspectorOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[calc(78dvh-4.5rem)] overflow-y-auto px-4 py-4">
              <div className="space-y-5">
                {selectedCommitOutsideGraph ? (
                  <div className="rounded-2xl border border-primary-fixed-dim bg-primary-fixed px-3 py-2 text-body-sm text-on-primary-fixed-variant">
                    Not in the current graph page. Task mapping is still available.
                  </div>
                ) : null}
                <section>
                  <div className="text-body-lg font-semibold text-on-surface">{selectedCommit.messageHeadline}</div>
                  {selectedCommit.messageBody ? (
                    <p className="mt-2 whitespace-pre-wrap text-body-md leading-6 text-on-surface-variant">{selectedCommit.messageBody}</p>
                  ) : null}
                </section>

                <section className="overflow-visible rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                    <InspectMetric
                      className="col-span-2"
                      label="Author"
                      value={selectedCommit.authorLogin ?? selectedCommit.authorName}
                    />
                    <InspectMetric label="Committed" value={formatInspectDate(selectedCommit.committedAt)} />
                    <InspectMetric label="Authored" value={formatInspectDate(selectedCommit.authoredAt)} />
                    <InspectMetric label="Changed files" value={String(selectedCommit.changedFiles)} />
                    <InspectMetric label="Additions" value={`+${selectedCommit.additions}`} />
                    <InspectMetric label="Deletions" value={`-${selectedCommit.deletions}`} />
                  </div>
                </section>

                <section>
                  <div className="font-label-md uppercase tracking-[0.08em] text-on-surface-variant">Parents</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCommit.parentShas.length > 0 ? (
                      selectedCommit.parentShas.map((parentSha) => (
                        <span key={parentSha} className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-label-sm text-on-surface-variant">
                          {parentSha.slice(0, 7)}
                        </span>
                      ))
                    ) : (
                      <span className="text-body-md text-on-surface-variant">Initial commit in current view</span>
                    )}
                  </div>
                </section>

                <section>
                  <div className="font-label-md uppercase tracking-[0.08em] text-on-surface-variant">Branch heads on this commit</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCommit.branchHeadNames.length > 0 ? (
                      selectedCommit.branchHeadNames.map((branchName) => (
                        <span key={branchName} className={`inline-flex rounded-full border px-2 py-0.5 text-label-sm ${branchPillClass(branchName)}`}>
                          {branchName}
                        </span>
                      ))
                    ) : (
                      <span className="text-body-md text-on-surface-variant">No included branch currently points to this commit.</span>
                    )}
                  </div>
                </section>

                {selectedCommit.pullRequest ? (
                  <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                    <div className="font-label-md uppercase tracking-[0.08em] text-on-surface-variant">Associated Pull Request</div>
                    <div className="mt-2 font-body-lg font-semibold text-on-surface">
                      #{selectedCommit.pullRequest.number} {selectedCommit.pullRequest.title}
                    </div>
                    <div className="mt-2 text-body-md text-on-surface-variant">State: {selectedCommit.pullRequest.state}</div>
                    <a
                      className="mt-3 inline-flex rounded border border-outline-variant bg-surface px-3 py-1.5 font-label-md text-label-md text-on-surface hover:bg-surface-container-low"
                      href={selectedCommit.pullRequest.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open pull request
                    </a>
                  </section>
                ) : null}

                <TaskTagEditor
                  activityKey={`commit:${selectedCommit.sha}`}
                  currentTasks={selectedCommitTaskLinks?.tasks ?? []}
                  error={selectedCommitTaskLinksError}
                  loading={selectedCommitTaskLinksLoading}
                  onSave={saveSelectedCommitTaskLinks}
                  repositoryId={repositoryId}
                  saving={selectedCommitTaskLinksSaving}
                  saveLabel="Save commit tags"
                  title="Tagged tasks"
                />
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {pullRequestsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklch,var(--color-ink)_28%,transparent)] p-6 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-popover)]">
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
              <div>
                <div className="font-label-md uppercase tracking-[0.08em] text-on-surface-variant">Pull Requests</div>
                <div className="mt-1 text-body-md text-on-surface">{data.repo.fullName}</div>
              </div>
              <button
                className="inline-flex h-8 items-center rounded border border-outline-variant bg-surface px-2.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-low"
                onClick={() => setPullRequestsOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4" ref={pullRequestsScrollRef}>
              {pullRequestsLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-label-sm text-on-surface-variant">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:-0.05s]" />
                    <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:0.1s]" />
                  </span>
                  <span>Loading pull requests</span>
                </div>
              ) : pullRequestsError ? (
                <div className="rounded-xl border border-error bg-error-container px-4 py-3 text-body-md text-on-error-container">
                  {pullRequestsError}
                </div>
              ) : pullRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-body-md text-on-surface-variant">
                  No pull requests were found for this repository.
                </div>
              ) : (
                <div className="space-y-3">
                  {pullRequests.map((pullRequest) => (
                    <div
                      key={pullRequest.id}
                      className="rounded-xl border border-outline-variant bg-surface px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <a
                          className="min-w-0 flex-1 transition-colors hover:text-primary"
                          href={pullRequest.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <div className="truncate text-body-md font-semibold text-on-surface">
                            #{pullRequest.number} {pullRequest.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-label-sm text-on-surface-variant">
                            <span className="truncate">{pullRequest.authorLogin ?? pullRequest.authorName}</span>
                            <span>•</span>
                            <span>{pullRequest.branchName}</span>
                            <span>•</span>
                            <span>Updated {formatCommitDate(pullRequest.updatedAt)}</span>
                            <span>•</span>
                            <span>{pullRequest.taggedTaskCount} task{pullRequest.taggedTaskCount === 1 ? "" : "s"}</span>
                          </div>
                        </a>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            pullRequest.state === "MERGED"
                ? "bg-primary-fixed text-on-primary-fixed-variant"
                              : pullRequest.state === "OPEN"
                                ? "bg-success-muted text-success"
                                : "bg-surface-container-high text-on-surface-variant"
                          }`}>
                            {pullRequest.state}
                          </span>
                          <button
                            className="inline-flex h-8 items-center rounded border border-outline-variant bg-surface-container-lowest px-2.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-low"
                            onClick={() => void togglePullRequestTaskEditor(pullRequest.number)}
                            type="button"
                          >
                            {expandedPullRequestNumber === pullRequest.number ? "Hide tags" : "Tag tasks"}
                          </button>
                        </div>
                      </div>

                      {expandedPullRequestNumber === pullRequest.number ? (
                        <div className="mt-4">
                          <TaskTagEditor
                            activityKey={`pull_request:${pullRequest.number}`}
                            currentTasks={pullRequestTaskLinks[pullRequest.number]?.tasks ?? []}
                            error={pullRequestTaskErrorByNumber[pullRequest.number] ?? null}
                            loading={pullRequestTaskLoadingNumber === pullRequest.number}
                            onSave={(cardIds) => savePullRequestTaskLinks(pullRequest.number, cardIds)}
                            repositoryId={repositoryId!}
                            saving={pullRequestTaskSavingNumber === pullRequest.number}
                            saveLabel="Save PR tags"
                            title={`Tagged tasks for PR #${pullRequest.number}`}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}

                  <div ref={pullRequestsLoadMoreRef} />

                  {pullRequestsLoadingMore ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-label-sm text-on-surface-variant">
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:-0.2s]" />
                        <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:-0.05s]" />
                        <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:0.1s]" />
                      </span>
                      <span>Loading more pull requests</span>
                    </div>
                  ) : null}

                  {pullRequestsPageInfo && !pullRequestsPageInfo.hasMore ? (
                    <div className="py-2 text-center text-label-sm text-on-surface-variant">
                      End of pull requests
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GraphPath({ path }: { path: SvgPathPrimitive }) {
  return (
    <path
      d={path.d}
      fill="none"
      stroke={path.color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={path.strokeWidth}
    />
  );
}

function GraphNode({ node }: { node: SvgNodePrimitive }) {
  const strokeWidth = node.accent ? 2.6 : 2.2;

  if (node.shape === "diamond") {
    return (
      <rect
        fill="white"
        height={node.r * 2}
        rx={2}
        stroke={node.color}
        strokeWidth={strokeWidth}
        transform={`rotate(45 ${node.cx} ${node.cy})`}
        width={node.r * 2}
        x={node.cx - node.r}
        y={node.cy - node.r}
      />
    );
  }

  if (node.shape === "ring") {
    return (
      <>
        <circle cx={node.cx} cy={node.cy} fill="white" r={node.r} stroke={node.color} strokeWidth={strokeWidth} />
        <circle cx={node.cx} cy={node.cy} fill={node.color} r={Math.max(2.5, node.r - 4.5)} />
      </>
    );
  }

  return <circle cx={node.cx} cy={node.cy} fill="white" r={node.r} stroke={node.color} strokeWidth={strokeWidth} />;
}

function InspectMetric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="font-label-md uppercase tracking-[0.08em] leading-5 text-on-surface-variant">{label}</div>
      <div className="mt-1 min-w-0 break-words text-body-md leading-6 text-on-surface [hyphens:none]">{value}</div>
    </div>
  );
}

function formatCommitDate(input: string) {
  const date = new Date(input);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatInspectDate(input: string) {
  const date = new Date(input);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function branchPillClass(branchName: string) {
  const hash = Array.from(branchName).reduce((total, char) => total + char.charCodeAt(0), 0);
  return BRANCH_PILL_COLORS[hash % BRANCH_PILL_COLORS.length]!;
}

function diffBarWidth(additions: number, deletions: number, type: "additions" | "deletions") {
  const total = additions + deletions;
  if (total === 0) {
    return 0;
  }

  return type === "additions" ? (additions / total) * 100 : (deletions / total) * 100;
}
