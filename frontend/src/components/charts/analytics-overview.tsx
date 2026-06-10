import type { AnalyticsSnapshot } from "@emergence-devops/shared";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardDescription, CardTitle } from "../ui/card";

export function AnalyticsOverview({ analytics }: { analytics: AnalyticsSnapshot }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardTitle>Throughput and flow</CardTitle>
        <CardDescription>
          Analytics direction follows the shadcn activity-focused shell and repository statistics chart families.
        </CardDescription>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="h-72 rounded-3xl border border-outline-variant bg-surface p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.throughput}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" />
                <XAxis dataKey="label" stroke="var(--color-ink-3)" />
                <YAxis stroke="var(--color-ink-3)" />
                <Tooltip />
                <Bar dataKey="value" fill="var(--accent)" radius={[12, 12, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72 rounded-3xl border border-outline-variant bg-surface p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.cumulativeFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" />
                <XAxis dataKey="label" stroke="var(--color-ink-3)" />
                <YAxis stroke="var(--color-ink-3)" />
                <Tooltip />
                <Area type="monotone" dataKey="backlog" stackId="1" stroke="var(--color-rule-strong)" fill="var(--color-paper-3)" />
                <Area type="monotone" dataKey="notStarted" stackId="1" stroke="var(--color-ink-3)" fill="var(--color-panel-3)" />
                <Area type="monotone" dataKey="active" stackId="1" stroke="var(--color-accent)" fill="var(--color-accent-soft)" />
                <Area type="monotone" dataKey="review" stackId="1" stroke="var(--color-warning)" fill="var(--color-warning-soft)" />
                <Area type="monotone" dataKey="done" stackId="1" stroke="var(--color-success)" fill="var(--color-success-soft)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <div className="grid gap-4">
        <MetricCard label="Cycle time" value={`${analytics.cycleTimeDays} days`} tone="text-[var(--color-accent)]" />
        <MetricCard label="Lead time" value={`${analytics.leadTimeDays} days`} tone="text-[var(--color-success)]" />
        <MetricCard label="Merge latency" value={`${analytics.mergeLatencyHours} hours`} tone="text-[var(--color-warning)]" />
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="flex min-h-32 flex-col justify-between">
      <CardDescription>{label}</CardDescription>
      <p className={`font-headline-lg text-headline-lg font-semibold tracking-[-0.02em] ${tone}`}>{value}</p>
    </Card>
  );
}
