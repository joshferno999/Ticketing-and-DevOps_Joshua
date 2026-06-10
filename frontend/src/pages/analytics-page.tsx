import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AnalyticsSnapshot } from "@emergence-devops/shared";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AnalyticsPanelsSkeleton } from "../components/ui/loading";
import { api } from "../lib/api";
import { useSession } from "../hooks/use-session";
import { useNavigate } from "react-router-dom";

const CHART_GRID = "color-mix(in oklch, var(--color-rule) 62%, transparent)";
const CHART_AXIS = "var(--color-ink-3)";
const CHART_ACCENT = "var(--color-accent)";
const CHART_SUCCESS = "var(--color-success)";
const CHART_WARNING = "var(--color-warning)";
const CHART_DANGER = "var(--color-danger)";
const CHART_NEUTRAL = "var(--color-rule-strong)";
const FEATURE_COLORS = [
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-info)",
  "var(--color-danger)",
  "var(--color-ink-3)"
];

export function AnalyticsPage() {
  const { loading, user } = useSession();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let active = true;
    setAnalyticsLoading(true);
    void api.getAnalytics()
      .then((payload) => {
        if (active) {
          setAnalytics(payload);
        }
      })
      .catch(() => {
        if (active) {
          setNotice("Analytics could not be refreshed right now.");
        }
      })
      .finally(() => {
        if (active) {
          setAnalyticsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  const snapshot = analytics;
  const hasAnalyticsData = snapshot
    ? snapshot.teamScorecard.totalCompletedWorkItems > 0 ||
      snapshot.teamScorecard.totalCommits > 0 ||
      snapshot.cumulativeFlow.some((item) => item.backlog > 0 || item.notStarted > 0 || item.active > 0 || item.review > 0 || item.done > 0)
    : false;

  const throughputData = useMemo(
    () =>
      snapshot?.teamScorecard.weekly.map((entry) => ({
        label: shortenWeekLabel(entry.label),
        completedWorkItems: entry.completedWorkItems,
        mergedPullRequests: entry.mergedPullRequests,
        commits: entry.commits
      })) ?? [],
    [snapshot]
  );

  const cumulativeFlowData = useMemo(
    () =>
      snapshot?.teamScorecard.weekly.map((entry) => ({
        label: shortenWeekLabel(entry.label),
        backlog: entry.backlog,
        notStarted: entry.notStarted,
        active: entry.active,
        review: entry.review,
        done: entry.done
      })) ?? [],
    [snapshot]
  );

  const qualityTrendData = useMemo(
    () =>
      snapshot?.teamScorecard.weekly.map((entry) => ({
        label: shortenWeekLabel(entry.label),
        cycleTimeDays: entry.medianCycleTimeDays,
        pullRequestLatencyHours: entry.medianPullRequestLatencyHours
      })) ?? [],
    [snapshot]
  );

  const coverageTrendData = useMemo(
    () =>
      snapshot?.teamScorecard.weekly.map((entry, index) => ({
        label: shortenWeekLabel(entry.label),
        reopenedWorkRate: entry.reopenedWorkRate,
        linkedWorkProxy: snapshot.coverage.completedCardsWithGitHubActivity.percentage,
        index
      })) ?? [],
    [snapshot]
  );

  const featureMixData = useMemo(
    () =>
      (snapshot?.teamScorecard.featureMix ?? [])
        .filter((item) => item.commits + item.pullRequests + item.workItems > 0)
        .slice(0, 6)
        .map((item, index) => ({
          name: item.feature,
          value: item.commits + item.pullRequests + item.workItems,
          fill: FEATURE_COLORS[index % FEATURE_COLORS.length]
        })),
    [snapshot]
  );

  function downloadFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportData() {
    if (!snapshot) {
      return;
    }

    downloadFile("engineering_analytics_team.json", JSON.stringify(snapshot, null, 2), "application/json");
    setNotice("Analytics snapshot downloaded.");
  }

  function generateReport() {
    if (!snapshot) {
      return;
    }

    const report = [
      "# Balanced Engineering Analytics Summary",
      "",
      `Window: ${snapshot.timeWindow.start} to ${snapshot.timeWindow.end}`,
      `Completed work items: ${snapshot.teamScorecard.totalCompletedWorkItems}`,
      `Merged pull requests: ${snapshot.teamScorecard.totalMergedPullRequests}`,
      `Commits: ${snapshot.teamScorecard.totalCommits}`,
      `Median cycle time: ${snapshot.teamScorecard.cycleTimeDays.median.toFixed(1)} days`,
      `Median PR latency: ${snapshot.teamScorecard.pullRequestLatencyHours.median.toFixed(1)} hours`,
      `Coverage - PR links: ${snapshot.coverage.pullRequests.percentage.toFixed(1)}%`,
      `Coverage - Commit links: ${snapshot.coverage.commits.percentage.toFixed(1)}%`,
      "",
      `DORA note: ${snapshot.doraInstrumentation.note}`
    ].join("\n");
    downloadFile("engineering_analytics_summary.md", report, "text/markdown");
    setNotice("Engineering analytics summary downloaded.");
  }

  function handleChartAction(title: string, action: "copy" | "focus") {
    if (!snapshot) {
      return;
    }

    if (action === "copy") {
      void navigator.clipboard.writeText(`${title}: ${chartSummary(title, snapshot)}`);
      setNotice(`Copied ${title} summary.`);
    } else {
      setNotice(chartSummary(title, snapshot));
    }
    setActiveMenu(null);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background-alt">
      <div className="flex shrink-0 flex-col gap-3 border-b border-outline-variant bg-surface/90 px-4 py-4 shadow-[0_1px_0_color-mix(in_oklch,var(--color-ink)_4%,transparent)] backdrop-blur-xl sm:px-gutter sm:py-stack-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-stack-sm">
          <button className="material-symbols-outlined rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface" onClick={() => navigate("/boards")} type="button">
            arrow_back
          </button>
          <span className="min-w-0 text-balance font-headline-md text-headline-md font-semibold text-on-surface">Analytics / Delivery Intelligence</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-60 sm:py-1.5" disabled={analyticsLoading || !snapshot} onClick={exportData} type="button">Export Data</button>
          <button className="rounded-xl bg-primary-container px-4 py-2 font-label-md text-label-md text-on-primary transition-colors hover:bg-inverse-surface disabled:opacity-60 sm:py-1.5" disabled={analyticsLoading || !snapshot} onClick={generateReport} type="button">Generate Report</button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-margin p-margin">
        {notice ? <div className="rounded border border-primary-fixed-dim bg-primary-fixed px-4 py-3 text-body-md text-on-primary-fixed-variant">{notice}</div> : null}
        <div className="mb-stack-sm flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Connected Delivery Snapshot</h2>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
              {`Balanced scorecard across ${snapshot?.timeWindow.weeks ?? 0} calendar weeks using persisted board data plus linked GitHub activity.`}
            </p>
          </div>
        </div>

        {analyticsLoading ? (
          <AnalyticsPanelsSkeleton />
        ) : !snapshot ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-margin text-body-md text-on-surface-variant shadow-[var(--shadow-panel)]">
            Analytics could not be loaded right now.
          </div>
        ) : !hasAnalyticsData ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-margin text-body-md text-on-surface-variant shadow-[var(--shadow-panel)]">
            No analytics data is available yet. Add work items, create board subtasks, and link GitHub activity to populate this snapshot.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-gutter md:grid-cols-4">
              <KpiCard label="Completed Work" trend={`${snapshot.timeWindow.weeks} wk window`} trendClass="text-story-blue" value={`${snapshot.teamScorecard.totalCompletedWorkItems}`} unit="items" onInfo={() => setNotice("Completed work tracks cards reaching Done within the reporting window.")} />
              <KpiCard label="Cycle Time" trend={`P75 ${snapshot.teamScorecard.cycleTimeDays.p75?.toFixed(1) ?? "0.0"}d`} trendClass="text-priority-high" value={snapshot.teamScorecard.cycleTimeDays.median.toFixed(1)} unit="days median" onInfo={() => setNotice("Cycle time measures how long completed work items took from creation to Done.")} />
              <KpiCard label="WIP Load" trend="Current board state" trendClass="text-on-surface-variant" value={`${snapshot.cumulativeFlow.at(-1)?.active ?? 0}`} unit="active items" onInfo={() => setNotice("WIP load shows the amount of work currently active on the board.")} />
              <KpiCard label="PR Latency" trend={`P75 ${snapshot.teamScorecard.pullRequestLatencyHours.p75?.toFixed(1) ?? "0.0"}h`} trendClass="text-story-blue" value={snapshot.teamScorecard.pullRequestLatencyHours.median.toFixed(1)} unit="hours median" onInfo={() => setNotice("PR latency highlights the time between PR creation and merge completion for merged pull requests.")} />
            </div>

            <div className="grid grid-cols-1 gap-margin lg:grid-cols-2">
              <ChartPanel title="Throughput Velocity" activeMenu={activeMenu} setActiveMenu={setActiveMenu} onAction={handleChartAction}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={throughputData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="completedWorkItems" fill={CHART_ACCENT} name="Completed work" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="mergedPullRequests" fill={CHART_SUCCESS} name="Merged PRs" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Cumulative Flow" activeMenu={activeMenu} setActiveMenu={setActiveMenu} onAction={handleChartAction}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeFlowData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Area type="monotone" dataKey="backlog" stackId="1" stroke={CHART_NEUTRAL} fill="var(--color-paper-3)" name="Backlog" />
                    <Area type="monotone" dataKey="notStarted" stackId="1" stroke="var(--color-ink-3)" fill="var(--color-panel-3)" name="Not started" />
                    <Area type="monotone" dataKey="active" stackId="1" stroke={CHART_ACCENT} fill="var(--color-accent-soft)" name="Active" />
                    <Area type="monotone" dataKey="review" stackId="1" stroke={CHART_WARNING} fill="var(--color-warning-soft)" name="Review" />
                    <Area type="monotone" dataKey="done" stackId="1" stroke={CHART_SUCCESS} fill="var(--color-success-soft)" name="Done" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Cycle Time Trend" activeMenu={activeMenu} setActiveMenu={setActiveMenu} onAction={handleChartAction}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={qualityTrendData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="cycleTimeDays" stroke={CHART_DANGER} strokeWidth={3} dot={{ r: 4 }} name="Median cycle time (days)" />
                    <Line type="monotone" dataKey="pullRequestLatencyHours" stroke={CHART_ACCENT} strokeWidth={3} dot={{ r: 4 }} name="Median PR latency (hours)" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Feature Mix" activeMenu={activeMenu} setActiveMenu={setActiveMenu} onAction={handleChartAction}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Pie data={featureMixData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3}>
                      {featureMixData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>

            <div className="grid grid-cols-1 gap-margin xl:grid-cols-[1.35fr_1fr]">
              <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-stack-md shadow-[var(--shadow-panel)]">
                <div className="mb-4">
                  <h3 className="font-label-lg text-label-lg uppercase text-on-surface">Coverage and Contribution</h3>
                  <p className="mt-1 text-body-md text-body-md text-on-surface-variant">Service-level delivery trends stay separate from contributor drilldowns and DORA readiness.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <MiniStat label="PR link coverage" value={`${snapshot.coverage.pullRequests.percentage.toFixed(1)}%`} detail={`${snapshot.coverage.pullRequests.linked}/${snapshot.coverage.pullRequests.total} linked`} />
                  <MiniStat label="Commit link coverage" value={`${snapshot.coverage.commits.percentage.toFixed(1)}%`} detail={`${snapshot.coverage.commits.linked}/${snapshot.coverage.commits.total} linked`} />
                  <MiniStat label="Completed cards with GitHub" value={`${snapshot.coverage.completedCardsWithGitHubActivity.percentage.toFixed(1)}%`} detail={`${snapshot.coverage.completedCardsWithGitHubActivity.linked}/${snapshot.coverage.completedCardsWithGitHubActivity.total} linked`} />
                </div>
                <div className="mt-5 h-[280px] rounded-2xl border border-outline-variant bg-surface px-2 py-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={coverageTrendData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="linkedWorkProxy" stroke={CHART_ACCENT} strokeWidth={3} dot={{ r: 4 }} name="Linked-work coverage %" />
                      <Line type="monotone" dataKey="reopenedWorkRate" stroke={CHART_WARNING} strokeWidth={3} dot={{ r: 4 }} name="Reopened work rate %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-body-sm text-on-surface">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant">
                        <th className="px-2 py-2">Contributor</th>
                        <th className="px-2 py-2">Commits</th>
                        <th className="px-2 py-2">Merged PRs</th>
                        <th className="px-2 py-2">Completed Work</th>
                        <th className="px-2 py-2">Median Cycle</th>
                        <th className="px-2 py-2">Median PR Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.userScorecards.map((scorecard) => (
                        <tr key={scorecard.userKey} className="border-b border-outline-variant/60 last:border-b-0">
                          <td className="px-2 py-2">
                            <div className="font-label-md text-label-md">{scorecard.displayName}</div>
                            <div className="text-body-sm text-on-surface-variant">{scorecard.githubLogin ?? scorecard.userKey}</div>
                          </td>
                          <td className="px-2 py-2">{scorecard.metrics.commitsAuthored}</td>
                          <td className="px-2 py-2">{scorecard.metrics.pullRequestsMerged}</td>
                          <td className="px-2 py-2">{scorecard.metrics.workItemsCompleted}</td>
                          <td className="px-2 py-2">{scorecard.metrics.medianCycleTimeDays.toFixed(1)}d</td>
                          <td className="px-2 py-2">{scorecard.metrics.medianPullRequestLatencyHours.toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-stack-md shadow-[var(--shadow-panel)]">
                <div className="mb-4">
                  <h3 className="font-label-lg text-label-lg uppercase text-on-surface">DORA Status</h3>
                  <p className="mt-1 text-body-md text-on-surface-variant">{snapshot.doraInstrumentation.note}</p>
                </div>
                <div className="space-y-3">
                  {snapshot.doraInstrumentation.metrics.map((metric) => (
                    <div key={metric.key} className="rounded-2xl border border-outline-variant bg-surface px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-label-md text-label-md text-on-surface">{metric.label}</div>
                        <span className="rounded-full bg-surface-container-high px-2 py-1 text-[11px] uppercase tracking-wide text-on-surface-variant">{metric.status.replace("_", " ")}</span>
                      </div>
                      <p className="mt-2 text-body-sm text-on-surface-variant">{metric.reason}</p>
                      <p className="mt-2 text-body-sm text-on-surface">Needed: {metric.requiredSources.join(", ")}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function shortenWeekLabel(label: string) {
  return label.replace(" - ", " to ");
}

function MiniStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3">
      <div className="text-label-sm uppercase text-on-surface-variant">{label}</div>
      <div className="mt-1 font-headline-sm text-headline-sm text-on-surface">{value}</div>
      <div className="mt-1 text-body-sm text-on-surface-variant">{detail}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  trend,
  trendClass,
  onInfo
}: {
  label: string;
  value: string;
  unit: string;
  trend: string;
  trendClass: string;
  onInfo: () => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-outline-variant bg-surface-container-lowest p-stack-md shadow-[var(--shadow-panel)]">
      <div className="mb-2 flex items-start justify-between">
        <span className="font-label-md text-label-md uppercase text-on-surface-variant">{label}</span>
        <button className="material-symbols-outlined text-[14px] text-on-surface-variant transition-colors hover:text-primary" onClick={onInfo} type="button">
          info
        </button>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-headline-lg text-headline-lg tracking-[-0.02em] text-on-surface">{value}</span>
        <span className="font-body-md text-body-md text-on-surface-variant">{unit}</span>
      </div>
      <div className={`mt-2 flex items-center gap-1 font-label-md text-label-md ${trendClass}`}>
        <span className="material-symbols-outlined text-[13px]">{trend.includes("Current") ? "stacked_line_chart" : trend.startsWith("-") ? "trending_down" : "trending_up"}</span>
        <span>{trend}</span>
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  children,
  activeMenu,
  setActiveMenu,
  onAction
}: {
  title: string;
  children: ReactNode;
  activeMenu: string | null;
  setActiveMenu: (value: string | null) => void;
  onAction: (title: string, action: "copy" | "focus") => void;
}) {
  return (
    <div className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-panel)]">
      <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low p-stack-md">
        <h3 className="font-label-md text-label-md uppercase text-on-surface">{title}</h3>
        <div className="relative">
          <button className="material-symbols-outlined text-[18px] text-on-surface-variant transition-colors hover:text-primary" onClick={() => setActiveMenu(activeMenu === title ? null : title)} type="button">
            more_vert
          </button>
          {activeMenu === title ? (
            <div className="absolute right-0 top-8 z-20 w-48 rounded-2xl border border-outline-variant bg-surface p-2 shadow-[var(--shadow-popover)]">
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-body-md text-on-surface transition-colors hover:bg-surface-container-low" onClick={() => onAction(title, "copy")} type="button">
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                Copy summary
              </button>
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-body-md text-on-surface transition-colors hover:bg-surface-container-low" onClick={() => onAction(title, "focus")} type="button">
                <span className="material-symbols-outlined text-[16px]">insights</span>
                Explain metric
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="h-[300px] bg-surface px-3 py-4">{children}</div>
    </div>
  );
}

function chartSummary(title: string, analytics: AnalyticsSnapshot) {
  if (title === "Throughput Velocity") {
    return `Completed work totals ${analytics.teamScorecard.totalCompletedWorkItems} items across ${analytics.timeWindow.weeks} weeks.`;
  }
  if (title === "Cumulative Flow") {
    return `Flow now tracks backlog ${analytics.cumulativeFlow.at(-1)?.backlog ?? 0}, not started ${analytics.cumulativeFlow.at(-1)?.notStarted ?? 0}, and active ${analytics.cumulativeFlow.at(-1)?.active ?? 0} items.`;
  }
  if (title === "Cycle Time Trend") {
    return `Median cycle time is ${analytics.teamScorecard.cycleTimeDays.median.toFixed(1)} days, with p75 at ${(analytics.teamScorecard.cycleTimeDays.p75 ?? 0).toFixed(1)} days.`;
  }
  return `Feature mix highlights the main delivery areas across commits, pull requests, and completed work.`;
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-rule)",
  boxShadow: "var(--shadow-popover)"
};
