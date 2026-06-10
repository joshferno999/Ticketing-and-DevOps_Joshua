import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BusyButtonLabel, RepoListSkeleton } from "../components/ui/loading";
import { api, ApiError, type IntegrationStatusPayload } from "../lib/api";
import { connectGitHubForWorkspace } from "../lib/github-connect";
import { useSession } from "../hooks/use-session";

export function ReposPage() {
  const { loading, user } = useSession();
  const [status, setStatus] = useState<IntegrationStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [repoFilter, setRepoFilter] = useState("");
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingGitHub, setConnectingGitHub] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    void refreshStatus({ silent: true });
  }, [loading, user]);

  async function refreshStatus(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setError(null);
      setNotice(null);
      setRefreshing(true);
    }

    try {
      const syncResult = await api.syncGitHubInstallations();
      const nextStatus = await api.getIntegrationStatus();
      setStatus(nextStatus);
      if (!options?.silent) {
        setNotice(
          syncResult.repositoryCount && syncResult.repositoryCount > 0
            ? `Synced ${syncResult.repositoryCount} repositories from GitHub.`
            : "Repository access refreshed."
        );
      }
      return nextStatus;
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Repository status could not be refreshed.");
      }
      return null;
    } finally {
      setInitialLoadComplete(true);
      if (!options?.silent) {
        setRefreshing(false);
      }
    }
  }

  function watchForGitHubInstallation() {
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      const nextStatus = await refreshStatus({ silent: true });
      if (nextStatus?.github.connected) {
        setNotice("GitHub installation linked and repository access refreshed.");
        window.clearInterval(interval);
        return;
      }

      if (attempts >= 45) {
        window.clearInterval(interval);
      }
    }, 2000);
  }

  async function connectGitHub() {
    setError(null);
    setNotice(null);
    setConnectingGitHub(true);

    try {
      await connectGitHubForWorkspace({
        returnTo: "/repos",
        refresh: () => refreshStatus({ silent: true }),
        onSynced: setNotice,
        onError: setError,
        watchForConnection: watchForGitHubInstallation
      });
    } finally {
      setConnectingGitHub(false);
    }
  }

  const canAccessRepos = status?.capabilities?.canAccessRepos ?? status?.github.connected ?? false;

  const filteredInstallations = useMemo(() => {
    const term = repoFilter.trim().toLowerCase();
    if (!term) {
      return status?.github.installations ?? [];
    }

    return (status?.github.installations ?? []).filter((installation) =>
      `${installation.accountLogin} ${installation.targetType} ${installation.repositories.map((repository) => repository.fullName).join(" ")}`
        .toLowerCase()
        .includes(term)
    );
  }, [repoFilter, status?.github.installations]);

  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-background-alt">
      <div className="sticky top-0 z-30 flex flex-col gap-3 border-b border-outline-variant bg-surface/90 px-3 py-3 shadow-[0_1px_0_color-mix(in_oklch,var(--color-ink)_4%,transparent)] backdrop-blur-xl sm:px-gutter sm:py-stack-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 font-bold text-on-surface">
          <span className="material-symbols-outlined text-secondary">folder_open</span>
          <h1 className="font-headline-md text-headline-md font-semibold text-on-surface">Repositories</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-label-md text-label-md text-secondary transition-colors hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-70 sm:h-auto" disabled={refreshing} onClick={() => void refreshStatus()} type="button">
            <span className={`material-symbols-outlined text-[16px] ${refreshing ? "animate-spin" : ""}`}>sync</span>
            <BusyButtonLabel busy={refreshing} busyLabel="Refreshing">
              Refresh Access
            </BusyButtonLabel>
          </button>
          <button className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-transparent bg-primary-container px-3 py-1.5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-inverse-surface disabled:cursor-wait disabled:opacity-70 sm:h-auto" disabled={connectingGitHub} onClick={() => void connectGitHub()} type="button">
            <span className="material-symbols-outlined text-[16px]">add</span>
            <BusyButtonLabel busy={connectingGitHub} busyLabel="Opening">
              Add GitHub Installation
            </BusyButtonLabel>
          </button>
        </div>
      </div>

      <div className="flex flex-grow flex-col gap-4 px-3 py-4 sm:gap-margin sm:p-margin">
        {error ? <div className="rounded-2xl border border-error bg-error-container px-4 py-3 text-body-md text-on-error-container">{error}</div> : null}
        {notice ? <div className="rounded-2xl border border-primary-fixed-dim bg-primary-fixed px-4 py-3 text-body-md text-on-primary-fixed-variant">{notice}</div> : null}
        {!canAccessRepos ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant">
            Connect the GitHub App in <Link className="font-medium text-primary" to="/settings?section=github">Settings</Link> to access repository commit graphs and pull requests.
          </div>
        ) : null}

        <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-4 shadow-[var(--shadow-panel)] sm:p-margin">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">GitHub access summary</h2>
              <p className="mt-1 text-body-md text-on-surface-variant">Review which GitHub orgs or users are connected and exactly which repositories are currently granted.</p>
            </div>
            <div className="relative w-full lg:w-56">
              <span className="material-symbols-outlined absolute left-2 top-1.5 text-[14px] text-on-surface-variant">filter_list</span>
              <input className="h-9 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-7 pr-3 text-label-sm text-on-surface placeholder-on-surface-variant transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] lg:h-[28px]" placeholder="Filter installations or repos..." type="text" value={repoFilter} onChange={(event) => setRepoFilter(event.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {!initialLoadComplete ? (
              <RepoListSkeleton />
            ) : filteredInstallations.map((installation) => (
              <div key={installation.id} className="rounded-2xl border border-outline-variant bg-surface p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-body-lg text-body-lg font-semibold text-on-surface">{installation.accountLogin}</h3>
                      <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-label-sm text-on-surface-variant">
                        {installation.targetType}
                      </span>
                      <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-label-sm text-on-surface-variant">
                        {installation.repositorySelection === "all" ? "All repositories" : "Selected repositories"}
                      </span>
                    </div>
                    <p className="mt-1 text-body-md text-on-surface-variant">
                      {installation.repositoryCount} repositories granted through this {installation.accountType} installation.
                    </p>
                  </div>

                  {installation.settingsUrl ? (
                    <a
                      className="inline-flex w-full items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low sm:w-auto sm:py-1.5"
                      href={installation.settingsUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Manage access
                    </a>
                  ) : null}
                </div>

                {installation.repositories.length > 0 ? (
                  <>
                    <div className="mt-4 space-y-3 sm:hidden">
                      {installation.repositories.map((repository) => (
                        <Link key={repository.id} className="block rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm transition-colors hover:border-primary" to={canAccessRepos ? `/repos/${repository.id}/graph` : "/settings?section=github"}>
                          <div className="font-body-md font-semibold text-on-surface break-all">{repository.fullName}</div>
                          <div className="mt-2 text-label-sm text-on-surface-variant">
                            {installation.repositorySelection === "all" ? "Inherited from all-repository installation" : "Selected directly in GitHub"}
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm sm:block">
                      <table className="min-w-[640px] w-full whitespace-nowrap border-collapse text-left">
                      <thead>
                        <tr className="border-b border-outline-variant bg-surface-container-high">
                          <th className="px-4 py-2 font-label-md uppercase tracking-wide text-secondary">Repository</th>
                          <th className="px-4 py-2 font-label-md uppercase tracking-wide text-secondary">Grant source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant font-body-md text-on-surface">
                        {installation.repositories.map((repository) => (
                          <tr key={repository.id} className="transition-colors hover:bg-surface-container-lowest">
                            <td className="px-4 py-3 font-medium">
                              {canAccessRepos ? (
                                <Link className="group inline-flex items-center gap-2 text-on-surface transition-colors hover:text-primary" to={`/repos/${repository.id}/graph`}>
                                  <span>{repository.fullName}</span>
                                  <span className="material-symbols-outlined text-[15px] text-on-surface-variant transition-colors group-hover:text-primary">timeline</span>
                                </Link>
                              ) : (
                                <span className="text-on-surface-variant">{repository.fullName}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-on-surface-variant">
                              {installation.repositorySelection === "all" ? "Inherited from all-repository installation" : "Selected directly in GitHub"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-body-md text-on-surface-variant">
                    This installation is active, but no repositories are currently granted to the workspace.
                  </div>
                )}
              </div>
            ))}

            {filteredInstallations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-center text-body-md text-on-surface-variant">
                {status?.github.connected
                  ? "No installations match the current filter."
                  : "No GitHub installations are connected yet."}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <footer className="mt-auto flex w-full flex-col gap-3 border-t border-outline-variant bg-surface-container-lowest px-margin py-base sm:flex-row sm:items-center sm:justify-between">
        <div className="font-label-md text-label-md uppercase text-secondary opacity-90">© 2024 Emergence Devops</div>
        <div className="flex flex-wrap gap-4">
          <Link className="font-label-sm text-label-sm text-on-secondary-container transition-colors hover:text-primary" to="/settings?section=github">
            Connection Settings
          </Link>
          <Link className="font-label-sm text-label-sm text-on-secondary-container transition-colors hover:text-primary" to="/onboarding">
            Setup Guide
          </Link>
          <a className="font-label-sm text-label-sm text-on-secondary-container transition-colors hover:text-primary" href="mailto:support@emergencedevops.local?subject=Repository%20API%20help">
            API Support
          </a>
        </div>
      </footer>
    </div>
  );
}
