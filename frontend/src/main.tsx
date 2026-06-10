import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { resolveGitHubInstallRedirect } from "./lib/github-install";
import "./styles/global.css";

function GitHubInstallCallbackBridge() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const redirectUrl = resolveGitHubInstallRedirect(
    { search: window.location.search, origin: window.location.origin },
    apiBaseUrl
  );

  if (redirectUrl) {
    window.location.replace(redirectUrl);

    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        Finalizing GitHub installation...
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GitHubInstallCallbackBridge />
  </React.StrictMode>
);
