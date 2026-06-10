/**
 * BuildTrack — Slack Integration Status Page
 * Informational page showing Slack config status and planned features.
 * Route: /requests/slack
 */

export function SlackStatusPage() {
  const features = [
    {
      label: "Sponsor DMs on status change",
      status: "Pending config",
      statusType: "pending" as const,
      icon: "mail",
    },
    {
      label: "#product-requests channel cards",
      status: "Pending config",
      statusType: "pending" as const,
      icon: "tag",
    },
    {
      label: "SLA breach alerts",
      status: "Pending config",
      statusType: "pending" as const,
      icon: "notification_important",
    },
    {
      label: "/bug slash command",
      status: "Skeleton ready — not published",
      statusType: "skeleton" as const,
      icon: "terminal",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        {/* Slack-purple bolt icon stand-in */}
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-violet-600 text-[22px]">bolt</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Slack Integration</h1>
          <p className="text-sm text-on-surface-variant">BuildTrack notification layer</p>
        </div>
      </div>

      {/* Amber not-connected banner */}
      <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-amber-800 text-sm font-medium">
        <span className="material-symbols-outlined text-[18px] text-amber-500">warning</span>
        Not connected to API — Slack integration is not active
      </div>

      {/* Status card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-red-500">cancel</span>
          <h2 className="text-base font-semibold text-on-surface">Configuration Status: Not configured</h2>
        </div>

        <div className="flex flex-col gap-2">
          {/* SLACK_BOT_TOKEN row */}
          <div className="flex items-center justify-between rounded-xl bg-surface-container px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">key</span>
              <span className="text-sm font-mono text-on-surface-variant">SLACK_BOT_TOKEN</span>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[14px]">close</span>
              Not set
            </span>
          </div>

          {/* SLACK_SIGNING_SECRET row */}
          <div className="flex items-center justify-between rounded-xl bg-surface-container px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">lock</span>
              <span className="text-sm font-mono text-on-surface-variant">SLACK_SIGNING_SECRET</span>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[14px]">close</span>
              Not set
            </span>
          </div>
        </div>
      </div>

      {/* Planned features */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-on-surface">Planned Features</h2>
        <div className="flex flex-col gap-3">
          {features.map((f) => (
            <div
              key={f.label}
              className="flex items-center justify-between rounded-xl border border-outline-variant px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-violet-500 text-[18px]">{f.icon}</span>
                </div>
                <span className="text-sm font-medium text-on-surface">{f.label}</span>
              </div>

              {f.statusType === "pending" && (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                  Pending config
                </span>
              )}
              {f.statusType === "skeleton" && (
                <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                  Skeleton ready — not published
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Setup note */}
      <div className="flex gap-3 rounded-2xl bg-violet-50 border border-violet-200 px-5 py-4">
        <span className="material-symbols-outlined text-violet-500 text-[20px] mt-0.5 shrink-0">info</span>
        <p className="text-sm text-violet-800 leading-relaxed">
          To activate Slack integration, set{" "}
          <code className="font-mono bg-violet-100 px-1 py-0.5 rounded text-violet-700">SLACK_BOT_TOKEN</code> and{" "}
          <code className="font-mono bg-violet-100 px-1 py-0.5 rounded text-violet-700">SLACK_SIGNING_SECRET</code>{" "}
          in your <code className="font-mono bg-violet-100 px-1 py-0.5 rounded text-violet-700">.env</code> file and
          restart the backend.
        </p>
      </div>
    </div>
  );
}
