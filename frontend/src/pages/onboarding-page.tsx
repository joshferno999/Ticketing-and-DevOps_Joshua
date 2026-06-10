import { useEffect, useMemo, useState } from "react";
import type { OnboardingState } from "@emergence-devops/shared";
import { BusyButtonLabel, OnboardingPageSkeleton } from "../components/ui/loading";
import { ProfileAvatar } from "../components/ui/profile-avatar";
import { api, ApiError } from "../lib/api";
import { grantOnboardingAppAccess } from "../lib/onboarding-access";
import { connectGitHubForWorkspace } from "../lib/github-connect";
import { openExternalWindow } from "../lib/open-external-window";
import { useOnboardingBootstrap } from "../hooks/use-onboarding-bootstrap";
import { useSession } from "../hooks/use-session";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

type StepKey = "account" | "github" | "asana" | "board" | "columns";

export function OnboardingPage() {
  const { loading, user } = useSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const bootstrap = useOnboardingBootstrap(!loading && Boolean(user));
  const [connectingAsana, setConnectingAsana] = useState(false);
  const [syncingGitHub, setSyncingGitHub] = useState(false);
  const [skipGitHub, setSkipGitHub] = useState(false);

  useEffect(() => {
    if (!bootstrap.data) {
      return;
    }

    setState(bootstrap.data.state);
    if (bootstrap.error) {
      setError(bootstrap.error);
    }
  }, [bootstrap.data, bootstrap.error]);

  useEffect(() => {
    if (state?.asanaConnected || bootstrap.data?.integrations.status.asana.connected) {
      grantOnboardingAppAccess();
    }
  }, [bootstrap.data?.integrations.status.asana.connected, state?.asanaConnected]);

  function openAppRoute(path: string) {
    grantOnboardingAppAccess();
    navigate(path);
  }

  useEffect(() => {
    const integration = searchParams.get("integration");
    const statusValue = searchParams.get("status");
    if (!integration || !statusValue) {
      return;
    }

    if (integration === "github") {
      if (statusValue === "connected") {
        setNotice("GitHub installation connected. Review the selected repositories below before moving on.");
        void refreshState();
      } else if (statusValue === "invalid_state") {
        setError("The GitHub installation callback expired or could not be verified. Start the install again from onboarding.");
      } else if (statusValue === "missing_installation") {
        setError("GitHub did not return a valid installation. Try the installation again.");
      }
    }

    if (integration === "asana") {
      if (statusValue === "connected") {
        void refreshState().then((nextState) => {
          const displayName = nextState?.displayName?.trim();
          setNotice(displayName
            ? `Asana connected. Your workspace profile is now syncing as "${displayName}".`
            : "Asana connected. You can continue setup.");
        });
      } else if (statusValue === "invalid_state") {
        setError("The Asana authorization callback expired or could not be verified. Start authorization again.");
      } else if (statusValue === "missing_params") {
        setError("Asana did not return the expected authorization details. Try connecting again.");
      }
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("integration");
    nextParams.delete("status");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  async function refreshState() {
    const result = await bootstrap.reload({ silent: true });
    if (!result) {
      setError((current) => current ?? "Onboarding status could not be loaded.");
      return null;
    }

    setState(result.state);
    return result.state;
  }

  async function connectGitHub() {
    setError(null);
    setNotice(null);
    setConnectingGitHub(true);

    try {
      await connectGitHubForWorkspace({
        returnTo: "/onboarding",
        refresh: refreshState,
        onSynced: setNotice,
        onError: setError,
        watchForConnection: watchForGitHubInstallation
      });
    } finally {
      setConnectingGitHub(false);
    }
  }

  async function authorizeAsana() {
    setError(null);
    setNotice(null);
    setConnectingAsana(true);
    const popup = openExternalWindow();
    if (popup.blocked) {
      setError("Popup was blocked. Please allow popups for this site and try again.");
      return;
    }

    try {
      const url = await api.getAsanaAuthorizeUrl("/onboarding");
      if (!url) {
        popup.close();
        setError("Asana authorization could not be started right now.");
        return;
      }

      popup.navigate(url);
      setNotice("Complete Asana authorization in the popup to continue setup.");
      watchForAsanaConnection();
    } catch (cause) {
      popup.close();
      if (cause instanceof ApiError) {
        setError(cause.message);
        return;
      }

      setError("Asana authorization could not be started right now.");
    } finally {
      setConnectingAsana(false);
    }
  }

  async function syncExistingGitHubInstallations() {
    setError(null);
    setSyncingGitHub(true);

    try {
      const result = await api.syncGitHubInstallations();
      await refreshState();
      setNotice(result.synced > 0
        ? result.repositoryCount && result.repositoryCount > 0
          ? `Synced ${result.repositoryCount} repositories across ${result.synced} GitHub installation${result.synced === 1 ? "" : "s"}.`
          : result.source === "workspace"
            ? `Linked to ${result.synced} organization installation${result.synced === 1 ? "" : "s"} already connected in this workspace.`
            : `Imported ${result.synced} GitHub installation${result.synced === 1 ? "" : "s"} from GitHub.`
        : "No GitHub installations were available to import.");
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
        return;
      }

      setError("Existing GitHub installations could not be imported.");
    } finally {
      setSyncingGitHub(false);
    }
  }

  function watchForGitHubInstallation() {
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      const nextState = await refreshState();
      if (nextState?.githubInstalled) {
        setNotice("GitHub installation connected.");
        window.clearInterval(interval);
        return;
      }

      if (attempts >= 45) {
        window.clearInterval(interval);
      }
    }, 2000);
  }

  function watchForAsanaConnection() {
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      const nextState = await refreshState();
      if (nextState?.asanaConnected) {
        setNotice("Asana connection completed.");
        window.clearInterval(interval);
        return;
      }

      if (attempts >= 45) {
        window.clearInterval(interval);
      }
    }, 2000);
  }

  const steps = useMemo(() => {
    if (!state) {
      return [];
    }

    return [
      { key: "account" as const, label: "Workspace account ready", done: state.accountConnected },
      { key: "asana" as const, label: "Authorize Asana", done: state.asanaConnected },
      { key: "github" as const, label: "Install GitHub App (optional)", done: state.githubInstalled || skipGitHub },
      { key: "board" as const, label: "Choose parent work item", done: state.boardMapped },
      { key: "columns" as const, label: "Confirm board columns", done: state.columnsMapped }
    ];
  }, [skipGitHub, state]);

  const activeStep = useMemo<StepKey>(() => {
    if (!state || !state.asanaConnected) {
      return "asana";
    }
    if (!state.githubInstalled && !skipGitHub) {
      return "github";
    }
    if (!state.boardMapped) {
      return "board";
    }
    if (!state.columnsMapped) {
      return "columns";
    }
    return "account";
  }, [skipGitHub, state]);

  const stepLabel = useMemo(() => {
    switch (activeStep) {
      case "asana":
        return "Step 1";
      case "github":
        return "Step 2 (optional)";
      case "board":
        return "Step 3";
      case "columns":
        return "Step 4";
      default:
        return "Complete";
    }
  }, [activeStep]);

  const completed = steps.filter((step) => step.done).length;
  const githubInstallations = state?.githubInstallations ?? [];

  if (!loading && !user) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!bootstrap.ready) {
    return <OnboardingPageSkeleton />;
  }

  if (bootstrap.error && !state) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-margin">
        <div className="max-w-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin text-center shadow-[var(--shadow-panel)]">
          <p className="font-body-lg text-body-lg text-on-surface">{bootstrap.error}</p>
          <button
            className="mt-margin rounded-xl border border-transparent bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary"
            onClick={() => void bootstrap.reload()}
            type="button"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background md:flex-row">
      <aside className="hidden h-full w-sidebar-width flex-col border-r border-outline-variant bg-surface-container-low/92 md:flex">
        <div className="flex flex-col gap-base border-b border-outline-variant px-gutter py-margin">
          <h2 className="font-headline-md text-headline-md text-on-surface">Project Setup</h2>
          <p className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">{completed} of {steps.length} completed</p>
          <div className="mt-stack-sm h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full rounded-full bg-primary" style={{ width: `${steps.length > 0 ? (completed / steps.length) * 100 : 0}%` }} />
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-base overflow-y-auto px-stack-sm py-stack-md">
          {steps.map((step) => (
            <div
              key={step.key}
              className={`flex items-center gap-stack-sm rounded-2xl p-stack-sm ${activeStep === step.key ? "bg-inverse-surface text-inverse-on-surface shadow-sm" : "transition-colors hover:bg-surface-container-high"}`}
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full ${activeStep === step.key ? "border-2 border-primary bg-surface-container-lowest" : step.done ? "border border-outline bg-success-muted" : "border border-outline-variant"}`}>
                {activeStep === step.key ? <div className="h-2 w-2 rounded-full bg-primary" /> : step.done ? (
                  <span className="material-symbols-outlined text-[12px] text-on-surface" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check
                  </span>
                ) : null}
              </div>
              <span className={`font-body-md text-body-md ${step.done ? "line-through text-on-surface-variant opacity-70" : activeStep === step.key ? "font-semibold text-inherit" : "text-on-surface-variant"}`}>{step.label}</span>
            </div>
          ))}
        </nav>

        <div className="flex items-center justify-between border-t border-outline-variant bg-surface p-gutter">
          <button className="flex items-center gap-base font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary" onClick={() => navigate("/settings?section=github")} type="button">
            <span className="material-symbols-outlined text-[14px]">help_outline</span>
            Connection settings
          </button>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col overflow-y-auto bg-background">
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(var(--color-ink) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="z-10 border-b border-outline-variant bg-surface-container-low/95 px-4 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Project Setup</h2>
              <p className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">{completed} of {steps.length} completed</p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full rounded-full bg-primary" style={{ width: `${steps.length > 0 ? (completed / steps.length) * 100 : 0}%` }} />
            </div>
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {steps.map((step) => (
                  <div key={step.key} className={`rounded-full border px-3 py-1 text-label-sm ${activeStep === step.key ? "border-primary bg-primary-fixed text-primary" : step.done ? "border-outline bg-success-muted text-on-surface-variant" : "border-outline-variant bg-surface text-on-surface-variant"}`}>
                    {step.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="z-10 mx-auto flex min-h-full w-full max-w-5xl flex-1 flex-col items-center justify-center p-4 sm:p-margin">
          <div className="flex w-full flex-col overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-panel)]">
            <div className="relative h-2 w-full bg-surface-container-high">
              <div className="absolute left-0 top-0 h-full bg-primary transition-all duration-500" style={{ width: `${(completed / steps.length) * 100}%` }} />
            </div>

            <div className="flex flex-col gap-margin p-margin">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="self-start rounded bg-surface-container px-stack-sm py-1 font-label-md text-label-md uppercase tracking-wider text-secondary">
                  {stepLabel}
                </span>
                <button className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:text-on-surface" onClick={() => setNotice("GitHub repo selection stays native to GitHub. We summarize the current installation and repo grants here after each redirect.")} type="button">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  Why this flow?
                </button>
              </div>

              {error ? <div className="rounded-2xl border border-error bg-error-container px-4 py-3 text-body-md text-on-error-container">{error}</div> : null}
              {notice ? <div className="rounded-2xl border border-primary-fixed-dim bg-primary-fixed px-4 py-3 text-body-md text-on-primary-fixed-variant">{notice}</div> : null}

              {activeStep === "asana" ? (
                <section className="flex flex-col items-center gap-stack-md pt-stack-sm text-center">
                  {state?.avatarUrl ? (
                    <ProfileAvatar
                      alt={`${state.displayName ?? user?.name ?? "Asana user"} profile`}
                      avatarUrl={state.avatarUrl}
                      className="mb-base h-16 w-16 border border-outline-variant bg-surface-container-high shadow-[var(--shadow-panel)]"
                      iconClassName="text-[28px] text-on-surface-variant"
                    />
                  ) : (
                    <div className="mb-base flex h-16 w-16 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-high shadow-[var(--shadow-panel)]">
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>
                        task_alt
                      </span>
                    </div>
                  )}
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">Connect Asana</h1>
                  <p className="mx-auto max-w-md font-body-lg text-body-lg text-on-surface-variant">
                    Authorize Asana to continue. Your workspace display name and profile photo are taken from your Asana profile after approval.
                  </p>
                  {state?.displayName || state?.avatarUrl ? (
                    <div className="rounded-2xl border border-outline-variant bg-surface-container-low px-stack-md py-stack-sm font-body-md text-body-md text-on-surface">
                      {state?.displayName ? (
                        <p>
                          Display name: <span className="font-semibold">{state.displayName}</span>
                        </p>
                      ) : null}
                      {state?.avatarUrl ? (
                        <p className="mt-1 text-on-surface-variant">Profile photo is syncing from Asana.</p>
                      ) : null}
                    </div>
                  ) : null}
                  <button className="flex items-center gap-stack-sm rounded-xl border border-transparent bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-inverse-surface disabled:cursor-wait disabled:opacity-70" disabled={connectingAsana || state?.asanaConnected} onClick={() => void authorizeAsana()} type="button">
                    <BusyButtonLabel busy={connectingAsana} busyLabel="Opening">
                      {state?.asanaConnected ? "Asana connected" : "Authorize Asana"}
                    </BusyButtonLabel>
                    {!state?.asanaConnected ? <span className="material-symbols-outlined text-[14px]">open_in_new</span> : null}
                  </button>
                </section>
              ) : null}

              {activeStep === "github" ? (
                <section className="flex flex-col gap-6">
                  <div className="text-center">
                    <h1 className="font-headline-lg text-headline-lg text-on-surface">Install the GitHub App (optional)</h1>
                    <p className="mx-auto mt-3 max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
                      If a teammate already installed the app on your GitHub organization, choose “Use organization install” to share the same repositories. Otherwise install the app once for the org.
                    </p>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      <button className="flex items-center gap-stack-sm rounded-xl border border-transparent bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-inverse-surface disabled:cursor-wait disabled:opacity-70" disabled={connectingGitHub} onClick={() => void connectGitHub()} type="button">
                        <BusyButtonLabel busy={connectingGitHub} busyLabel="Opening">
                          {githubInstallations.length > 0 ? "Add another GitHub installation" : "Install GitHub App"}
                        </BusyButtonLabel>
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      </button>
                      <button className="rounded-xl border border-outline-variant bg-surface-container-lowest px-margin py-stack-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-70" disabled={syncingGitHub} onClick={() => void syncExistingGitHubInstallations()} type="button">
                        <BusyButtonLabel busy={syncingGitHub} busyLabel="Linking">
                          Use organization install
                        </BusyButtonLabel>
                      </button>
                      <button className="rounded-xl border border-transparent px-margin py-stack-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface" onClick={() => setSkipGitHub(true)} type="button">
                        Continue without GitHub
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {githubInstallations.map((installation) => (
                      <div key={installation.id} className="rounded-2xl border border-outline-variant bg-surface p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="font-body-lg text-body-lg font-semibold text-on-surface">{installation.accountLogin}</h2>
                              <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-label-sm text-on-surface-variant">
                                {installation.targetType}
                              </span>
                              <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-label-sm text-on-surface-variant">
                                {installation.repositorySelection === "all" ? "All repositories" : "Selected repositories"}
                              </span>
                            </div>
                            <p className="mt-1 text-body-md text-on-surface-variant">
                              {installation.repositoryCount} repositories currently granted through this {installation.accountType} installation.
                            </p>
                          </div>

                          {installation.settingsUrl ? (
                            <a className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low" href={installation.settingsUrl} rel="noreferrer" target="_blank">
                              Manage access
                            </a>
                          ) : null}
                        </div>

                        {installation.repositories.length > 0 ? (
                          <div className="mt-4 overflow-x-auto rounded-2xl border border-outline-variant">
                            <table className="min-w-[640px] w-full border-collapse text-left">
                              <thead className="border-b border-outline-variant bg-surface-container-high">
                                <tr>
                                  <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Repository</th>
                                  <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Grant source</th>
                                </tr>
                              </thead>
                              <tbody className="font-body-md text-body-md text-on-surface">
                                {installation.repositories.map((repository) => (
                                  <tr key={repository.id} className="border-b border-outline-variant last:border-b-0">
                                    <td className="px-stack-md py-stack-sm">{repository.fullName}</td>
                                    <td className="px-stack-md py-stack-sm text-on-surface-variant">
                                      {installation.repositorySelection === "all" ? "Inherited from all-repository installation" : "Selected directly in GitHub"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-body-md text-on-surface-variant">
                            This installation is connected, but GitHub is not currently granting any repositories to the workspace.
                          </div>
                        )}
                      </div>
                    ))}

                    {githubInstallations.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-outline-variant bg-background-alt p-5 text-center text-body-md text-on-surface-variant">
                        GitHub is optional. Install the app now or continue without it.
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {activeStep === "board" ? (
                <section className="flex flex-col items-center gap-stack-md py-stack-sm text-center">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">Choose your parent work item</h1>
                  <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
                    Asana is connected. Pick a parent task in Work Items to create your first board, then manage it from Boards.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button className="rounded-xl border border-transparent bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-inverse-surface" onClick={() => openAppRoute("/work-items")} type="button">
                      Open Work Items
                    </button>
                    <button className="rounded-xl border border-outline-variant bg-surface-container-lowest px-margin py-stack-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low" onClick={() => openAppRoute("/boards")} type="button">
                      View boards
                    </button>
                  </div>
                </section>
              ) : null}

              {activeStep === "columns" ? (
                <section className="flex flex-col items-center gap-stack-md py-stack-sm text-center">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">Confirm board columns</h1>
                  <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
                    Finish setup by saving the Asana-to-board column mapping for your current workspace.
                  </p>
                  <button className="rounded-xl border border-transparent bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-inverse-surface" onClick={() => navigate("/settings?section=mapping")} type="button">
                    Review mappings
                  </button>
                </section>
              ) : null}

              {activeStep === "account" ? (
                <section className="flex flex-col items-center gap-stack-md py-stack-sm text-center">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">Workspace setup is complete</h1>
                  <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
                    Your workspace account, Asana access, and board setup are in place. Connect GitHub any time from settings if you skipped it.
                  </p>
                  <button className="rounded-xl border border-transparent bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-inverse-surface" onClick={() => openAppRoute("/boards")} type="button">
                    Open boards
                  </button>
                </section>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-outline-variant bg-surface px-4 py-stack-md sm:flex-row sm:items-center sm:justify-between sm:px-margin">
              <button className="flex items-center gap-base rounded-xl border border-transparent px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface" onClick={() => navigate("/settings?section=github")} type="button">
                <span className="material-symbols-outlined text-[14px]">tune</span>
                Open settings
              </button>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-stack-md">
                {activeStep === "github" ? (
                  <button className="px-stack-sm py-stack-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface" onClick={() => setSkipGitHub(true)} type="button">
                    Continue without GitHub
                  </button>
                ) : null}
                {(activeStep === "board" || activeStep === "columns" || activeStep === "account") && state?.asanaConnected ? (
                  <button className="px-stack-sm py-stack-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface" onClick={() => openAppRoute("/boards")} type="button">
                    Open boards
                  </button>
                ) : null}
                <button className="flex items-center gap-stack-sm rounded-xl border border-outline-variant bg-surface-container-lowest px-margin py-stack-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low" onClick={() => void refreshState()} type="button">
                  Refresh status
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
