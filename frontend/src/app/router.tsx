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
// BuildTrack pages
import { RequestsPage } from "../pages/requests/requests-page";
import { NewRequestPage } from "../pages/requests/new-request-page";
import { RequestDetailPage } from "../pages/requests/request-detail-page";
import { TriagePage } from "../pages/requests/triage-page";
import { MyQueuePage } from "../pages/requests/my-queue-page";
import { SponsorPortalPage } from "../pages/requests/sponsor-portal-page";
import { RequestsAnalyticsPage } from "../pages/requests/requests-analytics-page";
import { AdminPage } from "../pages/admin/admin-page";
import { SlackStatusPage } from "../pages/requests/slack-status-page";
import { StaleTicketsPage } from "../pages/requests/stale-tickets-page";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage />, errorElement: <RouteErrorBoundary /> },
  { path: "/sign-in", element: <SignInPage />, errorElement: <RouteErrorBoundary /> },
  { path: "/onboarding", element: <OnboardingPage />, errorElement: <RouteErrorBoundary /> },
  {
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // ── DevOps ──
      { path: "boards", element: <BoardsPage /> },
      { path: "repos", element: <ReposPage /> },
      { path: "repos/:repositoryId/graph", element: <RepoCommitGraphPage /> },
      { path: "work-items", element: <WorkItemsPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "settings", element: <SettingsPage /> },
      // ── BuildTrack ──
      { path: "requests", element: <RequestsPage /> },
      { path: "requests/new", element: <NewRequestPage /> },
      { path: "requests/new/build", element: <NewRequestPage /> },
      { path: "requests/analytics", element: <RequestsAnalyticsPage /> },
      { path: "requests/slack", element: <SlackStatusPage /> },
      { path: "requests/stale", element: <StaleTicketsPage /> },
      { path: "requests/:id", element: <RequestDetailPage /> },
      { path: "triage", element: <TriagePage /> },
      { path: "my-queue", element: <MyQueuePage /> },
      { path: "sponsor", element: <SponsorPortalPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "admin/*", element: <AdminPage /> },
      { path: "*", element: <Navigate to="/boards" replace /> }
    ]
  }
]);
