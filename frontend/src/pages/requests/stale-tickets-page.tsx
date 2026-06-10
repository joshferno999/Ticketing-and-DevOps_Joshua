/**
 * BuildTrack — Stale Tickets Page
 * Shows stale ticket policy and currently stale tickets.
 * Route: /requests/stale (or linked from admin)
 */

interface StaleTicket {
  id: string;
  title: string;
  status: string;
  daysInactive: number;
  assignee: string;
}

const STALE_TICKETS: StaleTicket[] = [
  {
    id: "REQ-005",
    title: "Add pipeline stage filter to DCC dashboard",
    status: "Submitted",
    daysInactive: 7,
    assignee: "Unassigned",
  },
  {
    id: "REQ-008",
    title: "Export to CSV for SCT reply dashboard",
    status: "Submitted",
    daysInactive: 6,
    assignee: "Unassigned",
  },
];

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    Submitted: { bg: "bg-amber-100 border-amber-200", text: "text-amber-700" },
    "In Review": { bg: "bg-blue-100 border-blue-200", text: "text-blue-700" },
    "In Progress": { bg: "bg-violet-100 border-violet-200", text: "text-violet-700" },
    Blocked: { bg: "bg-red-100 border-red-200", text: "text-red-700" },
    Shipped: { bg: "bg-green-100 border-green-200", text: "text-green-700" },
  };
  const style = map[status] ?? { bg: "bg-surface-container", text: "text-on-surface-variant" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text}`}>
      {status}
    </span>
  );
}

export function StaleTicketsPage() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-orange-600 text-[22px]">schedule</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Stale Tickets</h1>
          <p className="text-sm text-on-surface-variant">Policy enforcement & nightly BullMQ cron</p>
        </div>
      </div>

      {/* Amber not-connected banner */}
      <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-amber-800 text-sm font-medium">
        <span className="material-symbols-outlined text-[18px] text-amber-500">warning</span>
        Not connected to API — displaying hardcoded seed data
      </div>

      {/* Policy card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">policy</span>
          <h2 className="text-base font-semibold text-on-surface">Stale Ticket Policy</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-container px-4 py-3 flex items-start gap-3">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">hourglass_empty</span>
            <div>
              <p className="text-xs text-on-surface-variant font-medium mb-0.5">Inactivity threshold</p>
              <p className="text-sm font-semibold text-on-surface">60 days of no activity</p>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container px-4 py-3 flex items-start gap-3">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">notifications_active</span>
            <div>
              <p className="text-xs text-on-surface-variant font-medium mb-0.5">Notification</p>
              <p className="text-sm font-semibold text-on-surface">Full team via Slack</p>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container px-4 py-3 flex items-start gap-3">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">schedule</span>
            <div>
              <p className="text-xs text-on-surface-variant font-medium mb-0.5">Cron schedule</p>
              <p className="text-sm font-semibold text-on-surface">Nightly at 2:00 AM UTC (BullMQ)</p>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container px-4 py-3 flex items-start gap-3">
            <span className="material-symbols-outlined text-[18px] text-red-400 mt-0.5">cancel</span>
            <div>
              <p className="text-xs text-on-surface-variant font-medium mb-0.5">Worker status</p>
              <p className="text-sm font-semibold text-red-600">Not active — backend not connected</p>
            </div>
          </div>
        </div>

        {/* Last cron run */}
        <div className="flex items-center justify-between rounded-xl bg-surface-container px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">history</span>
            <span className="text-sm text-on-surface-variant font-medium">Last cron run</span>
          </div>
          <span className="text-sm text-on-surface-variant italic">Never (not connected)</span>
        </div>
      </div>

      {/* Potentially stale tickets table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-on-surface">Potentially Stale Tickets</h2>
          <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded-lg">
            Tickets &gt;3 days old with no update
          </span>
        </div>

        {STALE_TICKETS.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px] opacity-30">check_circle</span>
            <p className="text-sm opacity-60">No stale tickets at this time</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant text-left">
                  <th className="py-2 pr-4 font-medium">REQ ID</th>
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Days Inactive</th>
                  <th className="py-2 font-medium">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {STALE_TICKETS.map((ticket) => (
                  <tr key={ticket.id} className="text-on-surface hover:bg-surface-container transition-colors">
                    <td className="py-3 pr-4">
                      <span className="font-mono font-semibold text-primary">{ticket.id}</span>
                    </td>
                    <td className="py-3 pr-4 max-w-xs">
                      <span className="line-clamp-2 text-on-surface">{ticket.title}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusChip status={ticket.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-surface-container rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-orange-400"
                            style={{ width: `${Math.min((ticket.daysInactive / 60) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-orange-600">{ticket.daysInactive}d</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="text-on-surface-variant italic">{ticket.assignee}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Backend note */}
      <div className="flex gap-3 rounded-2xl bg-blue-50 border border-blue-200 px-5 py-4">
        <span className="material-symbols-outlined text-blue-500 text-[20px] mt-0.5 shrink-0">info</span>
        <p className="text-sm text-blue-800 leading-relaxed">
          Once the backend is connected and{" "}
          <code className="font-mono bg-blue-100 px-1 py-0.5 rounded text-blue-700">REDIS_URL</code> is configured,
          the BullMQ worker will automatically mark and notify stale tickets on the nightly schedule.
        </p>
      </div>
    </div>
  );
}
