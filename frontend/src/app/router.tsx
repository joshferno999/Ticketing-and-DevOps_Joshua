import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/app-shell";
import { RouteErrorBoundary } from "../components/layout/route-error-boundary";
import { AnalyticsPage } from "../pages/analytics-page";
import { BoardsPage } from "../pages/boards-page";
import { LandingPage } from "../pages/landing-page";
import { OnboardingPage } from "../pages/onboarding-page";
import { RepoCommitGraphPage } from "../pages/repo-commit-graph-page";
import { ReposPage } from "../pages/repos-page";
import { SettingsPage } from "../pages/settings-page";
import { SignInPage } from "../pages/sign-in-page";
import { WorkItemsPage } from "../pages/work-items-page";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage />, errorElement: <RouteErrorBoundary /> },
  { path: "/sign-in", element: <SignInPage />, errorElement: <RouteErrorBoundary /> },
  { path: "/onboarding", element: <OnboardingPage />, errorElement: <RouteErrorBoundary /> },
  {
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "boards", element: <BoardsPage /> },
      { path: "repos", element: <ReposPage /> },
      { path: "repos/:repositoryId/graph", element: <RepoCommitGraphPage /> },
      { path: "work-items", element: <WorkItemsPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/boards" replace /> }
    ]
  }
]);
