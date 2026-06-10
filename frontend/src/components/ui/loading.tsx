import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function InlineSpinner({
  className,
  size = "sm"
}: {
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const sizeClass =
    size === "xs" ? "h-3 w-3 border" : size === "md" ? "h-4 w-4 border-2" : "h-3.5 w-3.5 border-[1.5px]";

  return (
    <span
      aria-label="Loading"
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-current border-t-transparent opacity-60",
        sizeClass,
        className
      )}
      role="status"
    />
  );
}

export function LoadingDots({ className, tone = "primary" }: { className?: string; tone?: "primary" | "muted" }) {
  const dotClassName = tone === "muted" ? "bg-on-surface-variant" : "bg-primary";
  const sizeClass = tone === "muted" ? "h-1 w-1" : "h-1.5 w-1.5";

  return (
    <span aria-label="Loading" className={cn("inline-flex items-center gap-1", className)} role="status">
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className={cn(sizeClass, "status-activity-dot rounded-full", dotClassName)}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export function StatusActivityIndicator({ compact = false, tone = "success" }: { compact?: boolean; tone?: "success" | "primary" }) {
  const dotClassName = compact ? "h-1.5 w-1.5" : "h-2 w-2";
  const colorClass = tone === "primary" ? "bg-primary" : "bg-success";

  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className={cn(dotClassName, "status-activity-dot rounded-full", colorClass)}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export function BusyButtonLabel({
  busy,
  children,
  busyLabel
}: {
  busy: boolean;
  children: ReactNode;
  busyLabel?: string;
}) {
  if (!busy) {
    return <>{children}</>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <InlineSpinner size="xs" />
      <span>{busyLabel ?? children}</span>
    </span>
  );
}

export function InlineLoadingHint({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-body-md text-on-surface-variant", className)}>
      <LoadingDots tone="muted" />
      {label ? <span className="opacity-80">{label}</span> : null}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-2 p-gutter">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-md bg-surface-container-high/70" />
      ))}
    </div>
  );
}

function BoardCardSkeleton() {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-[var(--shadow-panel)]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="h-3 w-14 skeleton-shimmer rounded" />
        <div className="h-6 w-6 skeleton-shimmer rounded-full" />
      </div>
      <div className="mb-2 space-y-1.5">
        <div className="h-4 w-[92%] skeleton-shimmer rounded" />
        <div className="h-4 w-[68%] skeleton-shimmer rounded" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <div className="h-5 w-16 skeleton-shimmer rounded-full" />
        <div className="h-5 w-12 skeleton-shimmer rounded-full" />
      </div>
    </div>
  );
}

function BoardColumnSkeleton({ cardCount }: { cardCount: number }) {
  return (
    <div className="flex h-full min-h-0 w-[min(72vw,19.5rem)] min-w-[15rem] flex-shrink-0 flex-col rounded-2xl border border-outline-variant bg-surface-container-low shadow-[var(--shadow-panel)] lg:w-[17rem] xl:min-w-0 xl:w-auto">
      <div className="flex flex-shrink-0 items-center justify-between rounded-t-2xl border-b border-outline-variant bg-surface-container-lowest px-3 py-2.5">
        <div className="space-y-1.5">
          <div className="h-3.5 w-[4.5rem] skeleton-shimmer rounded" />
          <div className="h-2.5 w-[3.25rem] skeleton-shimmer rounded opacity-80" />
        </div>
        <div className="h-5 w-5 skeleton-shimmer rounded-full" />
      </div>
      <div className="enterprise-scrollbar flex min-h-[220px] flex-1 flex-col gap-2.5 overflow-hidden p-2.5">
        {cardCount > 0 ? (
          Array.from({ length: cardCount }).map((_, index) => <BoardCardSkeleton key={index} />)
        ) : (
          <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest px-4">
            <div className="h-6 w-6 skeleton-shimmer rounded-full opacity-60" />
            <div className="mt-3 h-3 w-28 skeleton-shimmer rounded" />
          </div>
        )}
      </div>
    </div>
  );
}

export function BoardPageSkeleton() {
  const columnCardCounts = [2, 1, 2, 1, 0];

  return (
    <div
      aria-busy="true"
      aria-label="Loading board"
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,var(--surface)_0%,var(--background-alt)_100%)]"
    >
      <div className="z-30 flex w-full flex-shrink-0 flex-col gap-3 border-b border-outline-variant bg-surface/90 px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 h-7 w-7 skeleton-shimmer rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="h-7 w-[min(100%,18rem)] skeleton-shimmer rounded-lg" />
              <div className="flex flex-wrap gap-1.5">
                <div className="h-5 w-24 skeleton-shimmer rounded-full" />
                <div className="h-5 w-20 skeleton-shimmer rounded-full" />
                <div className="h-5 w-28 skeleton-shimmer rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
            <div className="h-9 min-w-[210px] flex-1 skeleton-shimmer rounded-lg xl:max-w-[280px] xl:flex-none" />
            <div className="h-9 min-w-[210px] flex-1 skeleton-shimmer rounded-lg xl:max-w-[260px] xl:flex-none" />
            <div className="h-9 w-36 skeleton-shimmer rounded-lg" />
            <div className="h-9 w-28 skeleton-shimmer rounded-lg" />
            <div className="h-9 w-24 skeleton-shimmer rounded-lg" />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-hidden p-4">
        <div className="enterprise-scrollbar flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-1 xl:grid xl:grid-cols-5 xl:gap-3 xl:overflow-x-hidden">
          {columnCardCounts.map((cardCount, index) => (
            <BoardColumnSkeleton key={index} cardCount={cardCount} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BoardColumnsSkeleton() {
  return <BoardPageSkeleton />;
}

export function AnalyticsPanelsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-margin">
      <div className="grid grid-cols-1 gap-gutter md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-outline-variant bg-surface-container-lowest/80 shadow-[var(--shadow-panel)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-margin lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-2xl border border-outline-variant bg-surface-container-lowest/80 shadow-[var(--shadow-panel)]" />
        ))}
      </div>
    </div>
  );
}

export function RepoListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4 p-gutter">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-[var(--shadow-panel)]">
          <div className="h-5 w-48 animate-pulse rounded bg-surface-container-high/80" />
          <div className="mt-3 h-16 animate-pulse rounded-md bg-surface-container-high/50" />
        </div>
      ))}
    </div>
  );
}

function IntegrationsBootstrapStatus({ label = "Loading GitHub and Asana" }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-stack-md py-stack-lg text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-panel)]">
        <InlineSpinner className="text-primary opacity-100" size="md" />
      </div>
      <div className="space-y-2">
        <p className="font-body-lg text-body-lg text-on-surface">{label}</p>
        <div className="flex items-center justify-center gap-2">
          <LoadingDots tone="primary" />
          <span className="font-label-md text-label-md text-on-surface-variant">Preparing integrations</span>
        </div>
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading settings" className="flex min-h-full bg-background">
      <div className="flex w-64 flex-col gap-stack-sm border-r border-outline-variant bg-surface-container-lowest p-margin">
        <div className="mb-stack-sm h-4 w-40 skeleton-shimmer rounded" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-10 w-full skeleton-shimmer rounded-lg" />
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-margin p-margin">
        <div className="h-8 w-56 skeleton-shimmer rounded-lg" />
        <div className="min-h-[420px] rounded-2xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
          <IntegrationsBootstrapStatus />
          <div className="mt-margin space-y-4">
            <div className="h-24 skeleton-shimmer rounded-lg" />
            <div className="h-32 skeleton-shimmer rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OnboardingPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading onboarding" className="flex h-full bg-background">
      <aside className="hidden h-full w-sidebar-width flex-col border-r border-outline-variant bg-surface-container-low md:flex">
        <div className="flex flex-col gap-base border-b border-outline-variant px-gutter py-margin">
          <div className="h-6 w-36 skeleton-shimmer rounded-lg" />
          <div className="h-3 w-28 skeleton-shimmer rounded" />
          <div className="mt-stack-sm h-1.5 w-full skeleton-shimmer rounded-full" />
        </div>
        <nav className="flex flex-1 flex-col gap-base px-stack-sm py-stack-md">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-stack-sm rounded p-stack-sm">
              <div className="h-5 w-5 skeleton-shimmer rounded-full" />
              <div className="h-4 flex-1 skeleton-shimmer rounded" />
            </div>
          ))}
        </nav>
        <div className="h-12 border-t border-outline-variant skeleton-shimmer" />
      </aside>

      <main className="relative flex flex-1 flex-col overflow-y-auto bg-background">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(var(--color-ink) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="z-10 mx-auto flex min-h-full w-full max-w-5xl flex-1 flex-col items-center justify-center p-margin">
          <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-panel)]">
            <div className="h-2 w-full skeleton-shimmer" />
            <div className="flex flex-col gap-margin p-margin">
              <IntegrationsBootstrapStatus label="Loading onboarding" />
              <div className="mx-auto h-10 w-64 skeleton-shimmer rounded-lg" />
              <div className="mx-auto h-24 w-full max-w-md skeleton-shimmer rounded-lg" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function SessionCornerHint() {
  return (
    <div className="pointer-events-none absolute left-4 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-outline-variant/80 bg-surface/90 px-2.5 py-1 text-label-sm text-on-surface-variant shadow-[var(--shadow-popover)] backdrop-blur-xl">
      <InlineSpinner size="xs" />
      <span>Checking session</span>
    </div>
  );
}
