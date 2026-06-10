/**
 * BuildTrack — Requests Analytics Dashboard
 * Pure CSS/div-based charts, no external chart libraries.
 */

import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: string;
  label: string;
  value: string | number;
  trend?: string;
  trendPositive?: boolean;
}

interface HBarRowProps {
  label: string;
  count: number;
  max: number;
  color: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NotConnectedBanner() {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-amber-800 text-sm font-medium mb-6">
      <span className="material-symbols-outlined text-[18px] text-amber-500">warning</span>
      Not connected to API — displaying hardcoded seed data
    </div>
  );
}

function MetricCard({ icon, label, value, trend, trendPositive }: MetricCardProps) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-4xl font-bold text-on-surface">{value}</span>
      {trend && (
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
            trendPositive
              ? "bg-green-100 text-green-700"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {trend}
        </span>
      )}
    </div>
  );
}

function HBarRow({ label, count, max, color }: HBarRowProps) {
  const pct = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-44 shrink-0 text-sm text-on-surface-variant truncate">{label}</span>
      <div className="flex-1 h-5 bg-surface-container rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-5 shrink-0 text-sm font-semibold text-on-surface text-right">{count}</span>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function RequestsAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("all");

  const timeRanges: { key: "7d" | "30d" | "all"; label: string }[] = [
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "all", label: "All time" },
  ];

  // ── Chart data ──
  const statusData = [
    { label: "Submitted", count: 3, color: "bg-amber-400" },
    { label: "In Review", count: 2, color: "bg-blue-400" },
    { label: "In Progress", count: 2, color: "bg-violet-500" },
    { label: "Blocked", count: 1, color: "bg-red-500" },
    { label: "Shipped", count: 1, color: "bg-green-500" },
    { label: "Won't Fix", count: 0, color: "bg-gray-400" },
  ];

  const typeData = [
    { label: "Bug", count: 2, color: "bg-red-400" },
    { label: "Enhancement", count: 2, color: "bg-blue-400" },
    { label: "Data Reporting", count: 2, color: "bg-teal-400" },
    { label: "New Feature", count: 1, color: "bg-violet-400" },
    { label: "Process Change", count: 1, color: "bg-amber-400" },
    { label: "Sponsor Build", count: 0, color: "bg-gray-400" },
  ];

  const moduleData = [
    { label: "DCC › Pipeline", count: 2, color: "bg-violet-400" },
    { label: "DCC › Dashboard", count: 1, color: "bg-violet-300" },
    { label: "DCC › Deal Details", count: 1, color: "bg-violet-200" },
    { label: "SCT › Dashboard", count: 1, color: "bg-blue-400" },
    { label: "SCT › Sequence Mgmt", count: 1, color: "bg-blue-300" },
    { label: "SCT › Reply Dashboard", count: 1, color: "bg-blue-200" },
    { label: "Hiring Tool › Ops Tool", count: 1, color: "bg-teal-400" },
  ];

  const maxStatus = Math.max(...statusData.map((d) => d.count));
  const maxType = Math.max(...typeData.map((d) => d.count));
  const maxModule = Math.max(...moduleData.map((d) => d.count));

  // Resolution time sparkline (days per ticket; open tickets show current age)
  const sparkData = [
    { id: "REQ-001", days: 3 },
    { id: "REQ-002", days: 5 },
    { id: "REQ-003", days: 2 },
    { id: "REQ-004", days: 7 },
    { id: "REQ-005", days: 7 },
    { id: "REQ-006", days: 4 },
    { id: "REQ-007", days: 1 },
    { id: "REQ-008", days: 6 },
  ];
  const maxSpark = Math.max(...sparkData.map((d) => d.days));

  // Priority breakdown
  const priorityData = [
    { label: "P0", count: 1, bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
    { label: "P1", count: 2, bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
    { label: "P2", count: 3, bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
    { label: "P3", count: 2, bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  ];

  // SLA table
  const slaRows = [
    { priority: "P0", target: "24h", actual: "18h", status: "on-track" as const },
    { priority: "P1", target: "3 days", actual: "4.5 days", status: "breached" as const },
    { priority: "P2", target: "7 days", actual: "5 days", status: "on-track" as const },
    { priority: "P3", target: "14 days", actual: "—", status: "neutral" as const },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Requests Analytics</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">BuildTrack — ticket volume, SLA performance & trends</p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1">
          {timeRanges.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeRange(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                timeRange === key
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <NotConnectedBanner />

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard icon="confirmation_number" label="Total Requests" value={8} trend="+2 this week" trendPositive />
        <MetricCard icon="inbox" label="Open" value={5} />
        <MetricCard icon="local_shipping" label="Shipped This Month" value={1} />
        <MetricCard icon="timer" label="Avg Resolution (days)" value="4.2" />
      </div>

      {/* Charts row 1: Status + Type */}
      <div className="grid grid-cols-2 gap-4">
        {/* Status bar chart */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-on-surface">Requests by Status</h2>
          <div className="flex flex-col gap-3">
            {statusData.map((row) => (
              <HBarRow key={row.label} label={row.label} count={row.count} max={maxStatus} color={row.color} />
            ))}
          </div>
        </div>

        {/* Type bar chart */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-on-surface">Requests by Type</h2>
          <div className="flex flex-col gap-3">
            {typeData.map((row) => (
              <HBarRow key={row.label} label={row.label} count={row.count} max={maxType} color={row.color} />
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2: Module + Priority */}
      <div className="grid grid-cols-2 gap-4">
        {/* Module bar chart */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-on-surface">Requests by Module</h2>
          <div className="flex flex-col gap-3">
            {moduleData.map((row) => (
              <HBarRow key={row.label} label={row.label} count={row.count} max={maxModule} color={row.color} />
            ))}
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-on-surface">Priority Breakdown</h2>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {priorityData.map((p) => (
              <div
                key={p.label}
                className={`${p.bg} border ${p.border} rounded-xl p-4 flex flex-col items-center justify-center gap-1`}
              >
                <span className={`text-3xl font-bold ${p.text}`}>{p.count}</span>
                <span className={`text-sm font-semibold ${p.text}`}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sparkline chart */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-on-surface">Resolution Time per Ticket (days)</h2>
          <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded-lg">Open tickets show current age</span>
        </div>
        <div className="flex items-end gap-3 h-32">
          {sparkData.map((bar) => {
            const heightPct = maxSpark === 0 ? 0 : (bar.days / maxSpark) * 100;
            return (
              <div key={bar.id} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-xs font-semibold text-on-surface-variant">{bar.days}d</span>
                <div className="w-full flex items-end" style={{ height: "80px" }}>
                  <div
                    className="w-full rounded-t-lg bg-primary-container"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-on-surface-variant rotate-[-20deg] origin-center mt-1">{bar.id}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SLA section */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-on-surface">SLA Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant text-left">
                <th className="py-2 pr-6 font-medium">Priority</th>
                <th className="py-2 pr-6 font-medium">SLA Target</th>
                <th className="py-2 pr-6 font-medium">Avg Actual</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {slaRows.map((row) => (
                <tr key={row.priority} className="text-on-surface">
                  <td className="py-3 pr-6 font-semibold">{row.priority}</td>
                  <td className="py-3 pr-6 text-on-surface-variant">{row.target}</td>
                  <td className="py-3 pr-6">{row.actual}</td>
                  <td className="py-3">
                    {row.status === "on-track" && (
                      <span className="flex items-center gap-1.5 text-green-700 font-medium">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        On track
                      </span>
                    )}
                    {row.status === "breached" && (
                      <span className="flex items-center gap-1.5 text-red-600 font-medium">
                        <span className="material-symbols-outlined text-[16px]">warning</span>
                        Breached
                      </span>
                    )}
                    {row.status === "neutral" && (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
