import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { createGitHubService } from "../modules/github/github.service";
import { createAnalyticsService } from "../modules/analytics/analytics.service";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(args.outputDir ?? process.cwd());
  await fs.mkdir(outputDir, { recursive: true });

  const selectedUser = args.user
    ? await prisma.appUser.findFirst({
        where: {
          OR: [{ id: args.user }, { email: args.user }]
        }
      })
    : await prisma.appUser.findFirst({
        orderBy: {
          createdAt: "asc"
        }
      });

  if (!selectedUser) {
    throw new Error("No app user found. Pass --user <id|email> after onboarding a workspace user.");
  }

  const analyticsService = createAnalyticsService(prisma, createGitHubService(env));
  const reportBundle = await analyticsService.getReportBundle(selectedUser.id, args.weeks, { includeLiveGitHub: true });
  const { snapshot, dataset } = reportBundle.data;

  const teamJsonPath = path.join(outputDir, "engineering_analytics_team.json");
  await fs.writeFile(teamJsonPath, JSON.stringify(reportBundle.data, null, 2), "utf8");

  const teamWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(teamWorkbook, toSheet([
    ["Window start", snapshot.timeWindow.start],
    ["Window end", snapshot.timeWindow.end],
    ["Weeks", snapshot.timeWindow.weeks],
    ["Bucket type", snapshot.bucketType],
    [],
    ["Completed work items", snapshot.teamScorecard.totalCompletedWorkItems],
    ["Merged pull requests", snapshot.teamScorecard.totalMergedPullRequests],
    ["Commits", snapshot.teamScorecard.totalCommits],
    ["Additions", snapshot.teamScorecard.additions],
    ["Deletions", snapshot.teamScorecard.deletions],
    ["Churn ratio", snapshot.teamScorecard.churnRatio],
    ["Median cycle time (days)", snapshot.teamScorecard.cycleTimeDays.median],
    ["P75 cycle time (days)", snapshot.teamScorecard.cycleTimeDays.p75 ?? 0],
    ["Median PR latency (hours)", snapshot.teamScorecard.pullRequestLatencyHours.median],
    ["P75 PR latency (hours)", snapshot.teamScorecard.pullRequestLatencyHours.p75 ?? 0],
    ["Reopened work rate", snapshot.teamScorecard.reopenedWorkRate]
  ]), "Overview");
  XLSX.utils.book_append_sheet(teamWorkbook, toSheet([
    [
      "Label",
      "Week Start",
      "Week End",
      "Completed Work Items",
      "Merged PRs",
      "Commits",
      "Additions",
      "Deletions",
      "Median Cycle Time",
      "Median PR Latency",
      "Reopened Items",
      "Reopened Rate",
      "Backlog",
      "Not Started",
      "Active",
      "Review",
      "Done"
    ],
    ...snapshot.teamScorecard.weekly.map((entry) => [
      entry.label,
      entry.weekStart,
      entry.weekEnd,
      entry.completedWorkItems,
      entry.mergedPullRequests,
      entry.commits,
      entry.additions,
      entry.deletions,
      entry.medianCycleTimeDays,
      entry.medianPullRequestLatencyHours,
      entry.reopenedWorkItems,
      entry.reopenedWorkRate,
      entry.backlog,
      entry.notStarted,
      entry.active,
      entry.review,
      entry.done
    ])
  ]), "Weekly Trends");
  XLSX.utils.book_append_sheet(teamWorkbook, toSheet([
    ["Coverage metric", "Linked", "Total", "Percentage"],
    ["Pull requests", snapshot.coverage.pullRequests.linked, snapshot.coverage.pullRequests.total, snapshot.coverage.pullRequests.percentage],
    ["Commits", snapshot.coverage.commits.linked, snapshot.coverage.commits.total, snapshot.coverage.commits.percentage],
    [
      "Completed cards with GitHub activity",
      snapshot.coverage.completedCardsWithGitHubActivity.linked,
      snapshot.coverage.completedCardsWithGitHubActivity.total,
      snapshot.coverage.completedCardsWithGitHubActivity.percentage
    ]
  ]), "Coverage & Mapping");
  XLSX.utils.book_append_sheet(teamWorkbook, toSheet([
    ["Feature", "Commits", "Pull Requests", "Work Items"],
    ...snapshot.teamScorecard.featureMix.map((item) => [item.feature, item.commits, item.pullRequests, item.workItems])
  ]), "Feature Breakdown");
  XLSX.utils.book_append_sheet(teamWorkbook, toSheet([
    ["Repo", "Full Name", "Commits", "Pull Requests", "Additions", "Deletions"],
    ...snapshot.teamScorecard.repoMix.map((item) => [item.repoName, item.fullName, item.commits, item.pullRequests, item.additions, item.deletions])
  ]), "Flow & Quality");
  XLSX.utils.book_append_sheet(teamWorkbook, toSheet([
    ["Metric", "Status", "Reason", "Required Sources"],
    ...snapshot.doraInstrumentation.metrics.map((item) => [item.label, item.status, item.reason, item.requiredSources.join(", ")]),
    [],
    ["Note", snapshot.doraInstrumentation.note]
  ]), "DORA Status");

  const teamWorkbookPath = path.join(outputDir, "engineering_analytics_team.xlsx");
  XLSX.writeFile(teamWorkbook, teamWorkbookPath);

  for (const userScorecard of snapshot.userScorecards) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, toSheet([
      ["User key", userScorecard.userKey],
      ["Display name", userScorecard.displayName],
      ["GitHub login", userScorecard.githubLogin ?? ""],
      [],
      ["Commits authored", userScorecard.metrics.commitsAuthored],
      ["PRs opened", userScorecard.metrics.pullRequestsOpened],
      ["PRs merged", userScorecard.metrics.pullRequestsMerged],
      ["Work items completed", userScorecard.metrics.workItemsCompleted],
      ["Median cycle time (days)", userScorecard.metrics.medianCycleTimeDays],
      ["Median PR latency (hours)", userScorecard.metrics.medianPullRequestLatencyHours],
      ["Additions", userScorecard.metrics.additions],
      ["Deletions", userScorecard.metrics.deletions],
      ["Churn ratio", userScorecard.metrics.churnRatio],
      ["Comment count", userScorecard.metrics.commentCount],
      ["Activity count", userScorecard.metrics.activityCount],
      ["Data quality flags", userScorecard.dataQualityFlags.join(", ")]
    ]), "Overview");
    XLSX.utils.book_append_sheet(workbook, toSheet([
      ["Label", "Week Start", "Week End", "Commits", "PRs Opened", "PRs Merged", "Work Items Completed", "Additions", "Deletions"],
      ...userScorecard.weeklySeries.map((entry) => [
        entry.label,
        entry.weekStart,
        entry.weekEnd,
        entry.commitsAuthored,
        entry.pullRequestsOpened,
        entry.pullRequestsMerged,
        entry.workItemsCompleted,
        entry.additions,
        entry.deletions
      ])
    ]), "Weekly Trends");
    XLSX.utils.book_append_sheet(workbook, toSheet([
      ["Feature", "Commits", "Pull Requests", "Work Items"],
      ...userScorecard.featureMix.map((item) => [item.feature, item.commits, item.pullRequests, item.workItems])
    ]), "Feature Mix");
    XLSX.utils.book_append_sheet(workbook, toSheet([
      ["Repo", "Full Name", "Commits", "Pull Requests", "Additions", "Deletions"],
      ...userScorecard.repoMix.map((item) => [item.repoName, item.fullName, item.commits, item.pullRequests, item.additions, item.deletions])
    ]), "PR & Commit Detail");
    XLSX.utils.book_append_sheet(workbook, toSheet([
      ["Card ID", "Title", "Feature", "User Key", "Status", "Created At", "Completed At", "Cycle Time Days", "Has GitHub Activity"],
      ...dataset.workItems
        .filter((item) => item.userKey === userScorecard.userKey)
        .map((item) => [
          item.cardId,
          item.title,
          item.feature,
          item.userKey,
          item.statusKey,
          item.createdAt,
          item.completedAt ?? "",
          item.cycleTimeDays ?? "",
          item.hasGitHubActivity ? "yes" : "no"
        ])
    ]), "Work Items");

    const workbookPath = path.join(outputDir, `engineering_analytics_${sanitizeFileComponent(userScorecard.userKey)}.xlsx`);
    XLSX.writeFile(workbook, workbookPath);
  }

  console.log(JSON.stringify({
    user: {
      id: selectedUser.id,
      email: selectedUser.email
    },
    teamJsonPath,
    teamWorkbookPath,
    generatedUserReports: snapshot.userScorecards.length,
    outputDir
  }, null, 2));
}

function toSheet(rows: Array<Array<string | number>>) {
  return XLSX.utils.aoa_to_sheet(rows);
}

function sanitizeFileComponent(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function parseArgs(args: string[]) {
  const parsed: { user?: string; weeks: number; outputDir?: string } = {
    weeks: 4
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === "--user") {
      parsed.user = args[index + 1];
      index += 1;
    } else if (current === "--weeks") {
      parsed.weeks = Number(args[index + 1] ?? "4");
      index += 1;
    } else if (current === "--output-dir") {
      parsed.outputDir = args[index + 1];
      index += 1;
    }
  }

  return parsed;
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
