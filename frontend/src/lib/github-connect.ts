import { api, ApiError } from "./api";
import { openExternalWindow } from "./open-external-window";

export async function connectGitHubForWorkspace(input: {
  returnTo?: string;
  refresh: () => Promise<unknown>;
  onSynced: (message: string) => void;
  onError: (message: string) => void;
  watchForConnection: () => void;
}) {
  try {
    const result = await api.syncGitHubInstallations();
    await input.refresh();

    if (result.synced > 0) {
      input.onSynced(
        result.repositoryCount && result.repositoryCount > 0
          ? `Synced ${result.repositoryCount} repositories from GitHub.`
          : result.source === "workspace"
            ? "Linked to the GitHub organization installation already used in this workspace."
            : `Connected ${result.synced} GitHub installation${result.synced === 1 ? "" : "s"}.`
      );
      return;
    }

    const popup = openExternalWindow();
    if (popup.blocked) {
      input.onError("Popup was blocked. Please allow popups for this site and try again.");
      return;
    }

    const install = await api.getGitHubInstallUrl(input.returnTo);
    if (!install?.url) {
      popup.close();
      input.onError("GitHub App install link is unavailable right now.");
      return;
    }

    popup.navigate(install.url);
    input.onSynced("Finish the GitHub installation in the popup. We'll refresh automatically.");
    input.watchForConnection();
  } catch (cause) {
    if (cause instanceof ApiError) {
      input.onError(cause.message);
      return;
    }

    input.onError("GitHub could not be connected right now.");
  }
}
