import { useEffect, useState } from "react";
import { authClient } from "../auth/client";
import {
  api,
  ApiError,
  type AsanaProjectOption,
  type AsanaWorkspaceOption,
  type IntegrationStatusPayload
} from "../lib/api";
import { connectGitHubForWorkspace } from "../lib/github-connect";
import { openExternalWindow } from "../lib/open-external-window";
import { useSession } from "../hooks/use-session";
import { BusyButtonLabel, SettingsPageSkeleton, StatusActivityIndicator } from "../components/ui/loading";
import { ProfileAvatar } from "../components/ui/profile-avatar";
import {
  fetchIntegrationBootstrap,
  useIntegrationBootstrap,
  type IntegrationBootstrapResult
} from "../hooks/use-integration-bootstrap";
import { broadcastSessionUserUpdated } from "../lib/session-events";
import { useSearchParams } from "react-router-dom";

type SettingsSection = "account" | "github" | "asana" | "mapping" | "webhooks";
type MappingRow = {
  source: string;
  destination: string;
  swatch: string;
};

const SECTION_LABELS: Record<SettingsSection, string> = {
  account: "Account Profile",
  github: "GitHub",
  asana: "Asana",
  mapping: "Project Mapping",
  webhooks: "Webhooks"
};

const MAPPING_STORAGE_KEY = "emergence.settings.mapping";
const PROJECT_STORAGE_KEY = "emergence.settings.project";

const defaultMappings: MappingRow[] = [
  { source: "Untriaged", destination: "Backlog", swatch: "bg-outline-variant border-outline" },
  { source: "To Do", destination: "Not Started", swatch: "bg-task-yellow border-tertiary-container" },
  { source: "Doing", destination: "In Progress", swatch: "bg-primary-fixed border-primary-fixed-dim" },
  { source: "Completed", destination: "Done", swatch: "bg-surface-container border-outline" }
];

export function SettingsPage() {
  const { loading, user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<IntegrationStatusPayload | null>(null);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [githubActivityLabel, setGitHubActivityLabel] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [mappings, setMappings] = useState<MappingRow[]>(defaultMappings);
  const [workspaces, setWorkspaces] = useState<AsanaWorkspaceOption[]>([]);
  const [projects, setProjects] = useState<AsanaProjectOption[]>([]);
  const [connectingAsana, setConnectingAsana] = useState(false);
  const [syncingAsanaProfile, setSyncingAsanaProfile] = useState(false);

  const section = resolveSection(searchParams.get("section"));
  const bootstrap = useIntegrationBootstrap(!loading && Boolean(user));

  useEffect(() => {
    if (!bootstrap.data) {
      return;
    }

    applyIntegrationBootstrap(bootstrap.data, setStatus, setWorkspaces, setProjects, setSelectedProject);
    if (bootstrap.error) {
      setIntegrationError(bootstrap.error);
    }
  }, [bootstrap.data, bootstrap.error]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedProject = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (savedProject) {
      setSelectedProject(savedProject);
    }

    const savedMappings = window.localStorage.getItem(MAPPING_STORAGE_KEY);
    if (savedMappings) {
      try {
        const parsedMappings = JSON.parse(savedMappings) as MappingRow[];
        if (Array.isArray(parsedMappings) && parsedMappings.length > 0) {
          setMappings(parsedMappings);
        }
      } catch {
        // Ignore malformed local settings and keep defaults.
      }
    }
  }, []);

  useEffect(() => {
    const integration = searchParams.get("integration");
    const statusValue = searchParams.get("status");
    if (!integration || !statusValue) {
      return;
    }

    if (integration === "github") {
      if (statusValue === "connected") {
        setNotice("GitHub installation updated. Repository access has been refreshed.");
        void refreshStatus({ silent: true });
      } else if (statusValue === "invalid_state") {
        setIntegrationError("The GitHub installation callback expired or could not be verified. Start the install again from this page.");
      } else if (statusValue === "missing_installation") {
        setIntegrationError("GitHub did not return a valid installation. Try the installation again.");
      }
    }

    if (integration === "asana") {
      if (statusValue === "connected") {
        setNotice("Asana connected. Your workspace name and profile photo now sync from Asana.");
        void refreshStatus({ silent: true });
      } else if (statusValue === "invalid_state") {
        setIntegrationError("The Asana authorization callback expired or could not be verified. Start authorization again from this page.");
      } else if (statusValue === "missing_params") {
        setIntegrationError("Asana did not return the expected authorization details. Try connecting again.");
      }
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("integration");
    nextParams.delete("status");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  async function refreshStatus(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setIntegrationError(null);
    }

    try {
      const payload = await fetchIntegrationBootstrap();
      applyIntegrationBootstrap(payload, setStatus, setWorkspaces, setProjects, setSelectedProject);
      return payload.status;
    } catch (error) {
      if (!options?.silent) {
        if (error instanceof ApiError) {
          setIntegrationError(error.message);
        } else {
          setIntegrationError("Integration status could not be refreshed.");
        }
      }
      return null;
    }
  }

  function watchForIntegration(provider: "github" | "asana") {
    let attempts = 0;
    if (provider === "github") {
      setGitHubActivityLabel("Waiting for GitHub to confirm repository access");
    }
    const interval = window.setInterval(async () => {
      attempts += 1;
      const nextStatus = await refreshStatus({ silent: true });
      if (!nextStatus) {
        if (attempts >= 45) {
          if (provider === "github") {
            setGitHubActivityLabel(null);
          }
          window.clearInterval(interval);
        }
        return;
      }

      if (provider === "github" && nextStatus.github.connected) {
        setGitHubActivityLabel(null);
        setNotice("GitHub installation connected.");
        window.clearInterval(interval);
        return;
      }

      if (provider === "asana" && nextStatus.asana.connected) {
        setNotice("Asana connection completed.");
        window.clearInterval(interval);
        return;
      }

      if (attempts >= 45) {
        if (provider === "github") {
          setGitHubActivityLabel(null);
        }
        window.clearInterval(interval);
      }
    }, 2000);
  }

  async function connectAsana() {
    setIntegrationError(null);
    setConnectingAsana(true);
    const popup = openExternalWindow();
    if (popup.blocked) {
      setIntegrationError("Popup was blocked. Please allow popups for this site and try again.");
      setConnectingAsana(false);
      return;
    }
    const url = await api.getAsanaAuthorizeUrl("/settings?section=asana");
    if (url) {
      popup.navigate(url);
      setNotice("Complete Asana authorization in the popup. We'll refresh this page automatically.");
      watchForIntegration("asana");
      setConnectingAsana(false);
      return;
    }

    popup.close();
    setIntegrationError("Asana authorization could not be started. Sign in again and retry.");
    setConnectingAsana(false);
  }

  async function syncAsanaProfile() {
    setIntegrationError(null);
    setSyncingAsanaProfile(true);

    try {
      const response = await api.syncAsanaProfile();
      broadcastSessionUserUpdated(response.user);
      await refreshStatus({ silent: true });
      setNotice(response.user.avatarUrl
        ? "Asana profile synced. Your workspace name and profile photo are up to date."
        : "Asana profile synced. Your workspace name is up to date, and no profile photo is available on Asana.");
    } catch (error) {
      setIntegrationError(error instanceof ApiError ? error.message : "Asana profile could not be refreshed.");
    } finally {
      setSyncingAsanaProfile(false);
    }
  }

  async function connectGitHub() {
    setIntegrationError(null);
    setGitHubActivityLabel("Connecting GitHub");

    try {
      await connectGitHubForWorkspace({
        returnTo: "/settings?section=github",
        refresh: () => refreshStatus({ silent: true }),
        onSynced: setNotice,
        onError: setIntegrationError,
        watchForConnection: () => watchForIntegration("github")
      });
    } finally {
      setGitHubActivityLabel(null);
    }
  }

  async function syncExistingGitHubInstallations() {
    setIntegrationError(null);
    setGitHubActivityLabel("Syncing repositories from GitHub");

    try {
      const result = await api.syncGitHubInstallations();
      await refreshStatus({ silent: true });
      setNotice(result.synced > 0
        ? result.repositoryCount && result.repositoryCount > 0
          ? `Synced ${result.repositoryCount} repositories across ${result.synced} GitHub installation${result.synced === 1 ? "" : "s"}.`
          : result.source === "workspace"
            ? `Linked to ${result.synced} organization installation${result.synced === 1 ? "" : "s"} already connected in this workspace.`
            : `Imported ${result.synced} GitHub installation${result.synced === 1 ? "" : "s"} from GitHub.`
        : "No GitHub installations were available to import.");
    } catch (error) {
      if (error instanceof ApiError) {
        setIntegrationError(error.message);
        return;
      }

      setIntegrationError("Existing GitHub installations could not be imported.");
    } finally {
      setGitHubActivityLabel(null);
    }
  }

  function openGitHubSettings(settingsUrl?: string) {
    if (!settingsUrl) {
      setNotice("GitHub did not provide a settings URL for this installation. Re-run the install flow to refresh it.");
      return;
    }

    window.open(settingsUrl, "_blank", "noopener,noreferrer");
  }

  async function signOutAndReturn() {
    try {
      await authClient.signOut();
    } finally {
      window.location.assign("/sign-in");
    }
  }

  function setActiveSection(nextSection: SettingsSection) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("section", nextSection);
    setSearchParams(nextParams, { replace: true });
  }

  function updateMapping(index: number, destination: string) {
    setMappings((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, destination } : row))
    );
  }

  function saveChanges() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, selectedProject);
      window.localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mappings));
    }
    setNotice("Settings saved locally for this workspace.");
  }

  const githubInstallations = status?.github.installations ?? [];
  const githubConnected = status?.github.connected ?? false;

  if (!bootstrap.ready) {
    return <SettingsPageSkeleton />;
  }

  if (bootstrap.error && !status) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-margin">
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
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background lg:flex-row">
      <div className="flex shrink-0 flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest/92 px-3 py-3 sm:px-4 lg:w-64 lg:border-b-0 lg:border-r lg:px-margin lg:py-margin">
        <h2 className="font-label-md text-[0.95rem] uppercase tracking-[0.14em] text-on-surface-variant">Integrations & Sync</h2>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {(Object.keys(SECTION_LABELS) as SettingsSection[]).map((key) => (
            <button
              key={key}
              className={
                section === key
                  ? "flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-inverse-surface bg-inverse-surface px-3 py-2 text-[0.98rem] font-medium text-inverse-on-surface shadow-sm"
                  : "flex shrink-0 items-center justify-between gap-3 rounded-2xl px-3 py-2 text-[0.98rem] text-on-surface-variant transition-colors hover:bg-surface-container-low"
              }
              onClick={() => setActiveSection(key)}
              type="button"
            >
              <span>{SECTION_LABELS[key]}</span>
              {key === "github" && githubConnected ? <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-success)_16%,transparent)]" /> : null}
              {key === "asana" && status?.asana.connected ? <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-success)_16%,transparent)]" /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 max-w-5xl flex-1 flex-col gap-4 px-3 py-4 sm:gap-margin sm:p-margin">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{SECTION_LABELS[section]}</h1>
          <p className="mt-stack-sm font-body-md text-body-md text-on-surface-variant">{sectionDescription(section)}</p>
        </div>

        {integrationError ? (
          <div className="rounded-2xl border border-error bg-error-container px-4 py-3 text-body-md text-on-error-container">
            <div>{integrationError}</div>
            <div className="mt-3">
              <button className="h-[32px] rounded-xl border border-outline-variant bg-surface px-stack-md font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low" onClick={signOutAndReturn} type="button">
                Sign in again
              </button>
            </div>
          </div>
        ) : null}

        {notice ? <div className="rounded-2xl border border-primary-fixed-dim bg-primary-fixed px-4 py-3 text-body-md text-on-primary-fixed-variant">{notice}</div> : null}

        {section === "account" ? (
          <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="flex items-center gap-4">
                <ProfileAvatar
                  alt={`${user?.name ?? user?.email ?? "Workspace user"} profile`}
                  avatarUrl={user?.avatarUrl}
                  className="h-16 w-16 border border-outline-variant bg-surface-container-high"
                  iconClassName="text-[28px] text-on-surface-variant"
                />
                <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">{user?.name ?? "Workspace Operator"}</h2>
                <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{user?.email}</p>
                <p className="mt-3 max-w-2xl text-body-md text-on-surface-variant">Your local account powers boards, repository mapping, and integration setup while the workspace auth stack is being simplified.</p>
                </div>
              </div>
              <button className="rounded-xl border border-outline-variant bg-surface px-4 py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low" onClick={signOutAndReturn} type="button">
                Sign out
              </button>
            </div>
          </section>
        ) : null}

        {section === "github" ? (
          <>
            <section className={`rounded-3xl border p-margin shadow-[var(--shadow-panel)] transition-colors ${githubConnected ? "border-success bg-success-muted/60" : "border-outline-variant bg-surface-container-lowest"}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                <div>
                  <div className="mb-base flex items-center gap-stack-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${githubConnected ? "bg-success shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-success)_15%,transparent)]" : "bg-outline"}`} />
                    <h2 className="font-headline-md text-headline-md text-on-surface">{githubConnected ? "GitHub App installed" : "GitHub App not installed"}</h2>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    {githubConnected
                      ? `${githubInstallations.length} installation${githubInstallations.length === 1 ? "" : "s"} connected to this workspace.`
                      : "Install the GitHub App to sync pull requests, branches, and commit activity into boards."}
                  </p>
                </div>
                <button className="h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-[6px] font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-70 sm:h-[32px]" disabled={Boolean(githubActivityLabel)} onClick={() => void connectGitHub()} type="button">
                  <BusyButtonLabel busy={Boolean(githubActivityLabel)} busyLabel="Opening">
                    {githubConnected ? "Add installation" : "Install GitHub App"}
                  </BusyButtonLabel>
                </button>
              </div>

              {githubActivityLabel ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-success/30 bg-surface-container-lowest px-4 py-3">
                  <StatusActivityIndicator />
                  <div>
                    <div className="font-label-md text-label-md text-success">GitHub sync in progress</div>
                    <div className="mt-1 text-body-md text-on-surface-variant">{githubActivityLabel}</div>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-headline-md text-headline-md text-on-surface">Recovery tools</h3>
                  <p className="mt-1 text-body-md text-on-surface-variant">If GitHub reports success but this workspace still looks empty, import the app’s existing installations directly.</p>
                </div>
                <button
                  className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md leading-none text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-70"
                  disabled={Boolean(githubActivityLabel)}
                  onClick={() => void syncExistingGitHubInstallations()}
                  type="button"
                >
                  {githubActivityLabel ? <StatusActivityIndicator compact /> : null}
                  <span>{githubActivityLabel ? "Syncing installs" : "Use organization install"}</span>
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">Connected installations</h3>
                  <p className="mt-1 text-body-md text-on-surface-variant">Each card reflects the current repository access returned by GitHub.</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                {githubInstallations.map((installation) => (
                  <div key={installation.id} className="rounded-2xl border border-outline-variant bg-surface p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-body-lg text-body-lg font-semibold text-on-surface">{installation.accountLogin}</h4>
                          <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-label-sm text-on-surface-variant">
                            {installation.targetType}
                          </span>
                          <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-label-sm text-on-surface-variant">
                            {installation.repositorySelection === "all" ? "All repositories" : "Selected repositories"}
                          </span>
                        </div>
                        <p className="mt-1 text-body-md text-on-surface-variant">
                          {installation.repositoryCount} repos available to this workspace via a {installation.accountType} installation.
                        </p>
                      </div>

                      <button
                        className="inline-flex w-full items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low sm:w-auto sm:py-1.5"
                        onClick={() => openGitHubSettings(installation.settingsUrl)}
                        type="button"
                      >
                        Manage access
                      </button>
                    </div>

                    {installation.repositories.length > 0 ? (
                      <>
                        <div className="mt-4 space-y-3 sm:hidden">
                          {installation.repositories.map((repository) => (
                            <div key={repository.id} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-3">
                              <div className="font-body-md font-semibold text-on-surface break-all">{repository.fullName}</div>
                              <div className="mt-2 text-label-sm text-on-surface-variant">
                                {installation.repositorySelection === "all" ? "Inherited from all-repository install" : "Explicitly selected in GitHub"}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-outline-variant sm:block">
                          <table className="min-w-[640px] w-full border-collapse text-left">
                          <thead className="border-b border-outline-variant bg-surface-container-high">
                            <tr>
                              <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Repository</th>
                              <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Access mode</th>
                            </tr>
                          </thead>
                          <tbody className="font-body-md text-body-md text-on-surface">
                            {installation.repositories.map((repository) => (
                              <tr key={repository.id} className="border-b border-outline-variant last:border-b-0">
                                <td className="px-stack-md py-stack-sm">{repository.fullName}</td>
                                <td className="px-stack-md py-stack-sm text-on-surface-variant">
                                  {installation.repositorySelection === "all" ? "Inherited from all-repository install" : "Explicitly selected in GitHub"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-body-md text-on-surface-variant">
                        This installation is connected, but GitHub is not currently granting any repositories to the workspace. Use “Manage access” to choose repositories.
                      </div>
                    )}
                  </div>
                ))}

                {githubInstallations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-body-md text-on-surface-variant">
                    No GitHub installations are connected yet.
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : null}

        {section === "asana" ? (
          <section className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4 sm:gap-margin">
              {status?.asana.connected ? (
                <ProfileAvatar
                  alt={`${status?.auth.user?.name ?? status?.auth.user?.email ?? "Asana user"} profile`}
                  avatarUrl={status?.auth.user?.avatarUrl}
                  className="h-12 w-12 border border-outline-variant bg-surface-container-high"
                  iconClassName="text-[20px] text-story-blue"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-high">
                  <span className="material-symbols-outlined text-[20px] text-story-blue">sync_alt</span>
                </div>
              )}
              <div>
                <div className="mb-base flex items-center gap-stack-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${status?.asana.connected ? "bg-success" : "bg-outline"}`} />
                  <h3 className="font-headline-md text-headline-md text-on-surface">{status?.asana.connected ? "Connected to Asana" : "Asana not connected"}</h3>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Workspace: <strong>{status?.asana.connected ? status.asana.workspaceName ?? "Connected workspace" : "Not selected"}</strong>
                </p>
                {status?.asana.connected && status?.auth.user?.name ? (
                  <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
                    Synced profile: <strong>{status.auth.user?.name}</strong>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {status?.asana.connected ? (
                <button className="h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-[6px] font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-70 sm:h-[32px]" disabled={syncingAsanaProfile} onClick={() => void syncAsanaProfile()} type="button">
                  <BusyButtonLabel busy={syncingAsanaProfile} busyLabel="Syncing">
                    Sync profile from Asana
                  </BusyButtonLabel>
                </button>
              ) : null}
              <button className="h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-[6px] font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-70 sm:h-[32px]" disabled={connectingAsana} onClick={() => void connectAsana()} type="button">
                <BusyButtonLabel busy={connectingAsana} busyLabel="Opening">
                  {status?.asana.connected ? "Reconnect" : "Connect"}
                </BusyButtonLabel>
              </button>
            </div>
          </section>
        ) : null}

        {section === "mapping" ? (
          <>
            <section className="flex flex-col gap-stack-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Target Project</h3>
                <p className="mt-base font-body-md text-body-md text-on-surface-variant">Select the Asana project you wish to map to the current Emergence board.</p>
              </div>
              <div className="mt-stack-sm grid grid-cols-1 gap-gutter md:grid-cols-2">
                <div className="flex flex-col gap-base">
                  <label className="font-label-sm text-label-sm uppercase text-on-surface-variant">Asana Workspace</label>
                  <select className="h-[32px] cursor-not-allowed rounded-xl border border-outline-variant bg-surface-container-low px-stack-sm font-body-md text-body-md text-on-surface-variant opacity-70" disabled>
                    <option>{workspaces[0]?.name ?? "No workspace connected"}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-base">
                  <label className="font-label-sm text-label-sm uppercase text-on-surface-variant">Asana Project</label>
                  <select
                    className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-70"
                    value={selectedProject}
                    onChange={(event) => setSelectedProject(event.target.value)}
                    disabled={projects.length === 0}
                  >
                    {projects.length === 0 ? <option value="">No projects available</option> : null}
                    {projects.map((project) => (
                      <option key={project.gid} value={project.name}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-stack-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Status Enum Mapping</h3>
                <p className="mt-base font-body-md text-body-md text-on-surface-variant">Define how Asana task sections map to columns in your Emergence board.</p>
              </div>
              <div className="mt-stack-sm space-y-3 sm:hidden">
                {mappings.map((row, index) => (
                  <div key={row.source} className="rounded-2xl border border-outline-variant bg-surface p-3">
                    <div className="flex items-center gap-2 text-body-md font-medium text-on-surface">
                      <span className={`h-3 w-3 rounded-sm border ${row.swatch}`} />
                      {row.source}
                    </div>
                    <label className="mt-3 block font-label-sm uppercase tracking-[0.08em] text-on-surface-variant">Emergence Column</label>
                    <select className="mt-2 h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]" value={row.destination} onChange={(event) => updateMapping(index, event.target.value)}>
                      <option>Backlog</option>
                      <option>Not Started</option>
                      <option>In Progress</option>
                      <option>In PR</option>
                      <option>Done</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-stack-sm hidden overflow-x-auto rounded-2xl border border-outline-variant sm:block">
                <table className="min-w-[720px] w-full border-collapse text-left">
                  <thead className="border-b border-outline-variant bg-surface-container-high">
                    <tr>
                      <th className="w-1/2 px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Asana Section (Source)</th>
                      <th className="w-1/2 px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Emergence Column (Destination)</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md text-body-md text-on-surface">
                    {mappings.map((row, index) => (
                      <tr key={row.source} className="border-b border-outline-variant transition-colors last:border-b-0 hover:bg-surface-container-lowest">
                        <td className="flex items-center gap-stack-sm px-stack-md py-stack-sm">
                          <span className={`h-3 w-3 rounded-sm border ${row.swatch}`} />
                          {row.source}
                        </td>
                        <td className="px-stack-md py-stack-sm">
                          <select className="h-[32px] w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]" value={row.destination} onChange={(event) => updateMapping(index, event.target.value)}>
                            <option>Backlog</option>
                            <option>Not Started</option>
                            <option>In Progress</option>
                            <option>In PR</option>
                            <option>Done</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="mt-stack-md flex justify-end border-t border-outline-variant pt-margin">
              <button className="flex h-[32px] items-center justify-center rounded-xl bg-primary-container px-margin py-[8px] font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-inverse-surface" onClick={saveChanges} type="button">
                Save Changes
              </button>
            </div>
          </>
        ) : null}

        {section === "webhooks" ? (
          <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
            <h3 className="font-headline-md text-headline-md text-on-surface">Webhook health</h3>
            <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">GitHub and Asana callbacks are handled by the backend. Revisit the integration setup screens if tokens need to be refreshed.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                <div className="font-label-md uppercase tracking-wide text-on-surface-variant">GitHub App Setup URL</div>
                <div className="mt-2 text-body-md text-on-surface">`/integrations/github/setup`</div>
              </div>
              <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                <div className="font-label-md uppercase tracking-wide text-on-surface-variant">Asana OAuth callback</div>
                <div className="mt-2 text-body-md text-on-surface">`/integrations/asana/callback`</div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function applyIntegrationBootstrap(
  payload: IntegrationBootstrapResult,
  setStatus: (status: IntegrationStatusPayload) => void,
  setWorkspaces: (workspaces: AsanaWorkspaceOption[]) => void,
  setProjects: (projects: AsanaProjectOption[]) => void,
  setSelectedProject: (value: string | ((current: string) => string)) => void
) {
  setStatus(payload.status);
  if (payload.status.auth.user) {
    broadcastSessionUserUpdated(payload.status.auth.user);
  }
  setWorkspaces(payload.workspaces);
  setProjects(payload.projects);
  setSelectedProject((current) => {
    if (current && payload.projects.some((project) => project.name === current)) {
      return current;
    }
    return payload.projects[0]?.name ?? "";
  });
}

function resolveSection(input: string | null): SettingsSection {
  if (input === "account" || input === "github" || input === "asana" || input === "mapping" || input === "webhooks") {
    return input;
  }

  return "github";
}

function sectionDescription(section: SettingsSection) {
  if (section === "account") {
    return "Review your active workspace identity and safely sign out when needed.";
  }
  if (section === "github") {
    return "Install the GitHub App and verify which repositories are connected to this workspace.";
  }
  if (section === "asana") {
    return "Manage the bidirectional synchronization between your Asana tasks and Emergence boards.";
  }
  if (section === "mapping") {
    return "Choose the target Asana project and save the status mapping used by your current board.";
  }
  return "Track the callback endpoints that power GitHub and Asana ingestion.";
}
