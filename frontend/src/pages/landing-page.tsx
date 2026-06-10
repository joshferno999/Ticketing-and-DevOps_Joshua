import { useState } from "react";
import { Link } from "react-router-dom";
import { LandingHeroGraph } from "../components/landing/landing-hero-graph";
import { CompanyLogo } from "../components/brand/company-logo";
import { useReveal } from "../hooks/use-reveal";
import { cn } from "../lib/utils";

type WorkflowStep = {
  id: string;
  title: string;
  detail: string;
};

const platformSurfaces = ["Boards", "Work Items", "Repository access", "Commit graph", "Tagged PR context", "Analytics snapshot"];

const capabilities = [
  {
    title: "Turn parent tasks into operating boards.",
    body: "Bring a parent task in from Asana, create its connected board, then manage subtasks, assignees, comments, and board-level movement without losing upstream context.",
    points: ["Parent-task import", "Connected subtasks", "Board-level operations"]
  },
  {
    title: "Inspect repository access and branch history.",
    body: "Review granted installations, open repository commit graphs, follow pull request context, and see where branch movement supports work on the board.",
    points: ["Installation sync", "Commit graph timeline", "Pull request context"]
  },
  {
    title: "Tag commits and pull requests to the work they move.",
    body: "Link task activity directly to commits and pull requests so engineering leads can audit what shipped and which work items advanced.",
    points: ["Commit tagging", "PR tagging", "Cross-reference inspection"]
  },
  {
    title: "Read delivery coverage and flow from one surface.",
    body: "Track throughput, flow, cycle time, coverage, and downloadable summaries without building a separate reporting stack.",
    points: ["Coverage snapshot", "Flow trends", "Exportable reports"]
  }
] as const;

const workflowSteps: WorkflowStep[] = [
  {
    id: "capture",
    title: "Capture the work source",
    detail: "Select a parent task in Asana and turn it into an active work item with its own connected board."
  },
  {
    id: "coordinate",
    title: "Coordinate board execution",
    detail: "Run the work through columns, assignees, comments, and movement rules that reflect active delivery."
  },
  {
    id: "trace",
    title: "Trace code movement",
    detail: "Inspect repository access, branch paths, commits, and pull requests tied back to the work."
  },
  {
    id: "report",
    title: "Report with context",
    detail: "Use analytics coverage and downloadable summaries to explain what moved and what remains exposed."
  }
];

const navLinks = [
  { href: "#platform", label: "Platform" },
  { href: "#workflow", label: "Workflow" },
  { href: "#coverage", label: "Coverage" }
] as const;

function LandingNav({ mobileOpen, onToggle, onNavigate }: { mobileOpen: boolean; onToggle: () => void; onNavigate: () => void }) {
  return (
    <header className="landing-nav sticky top-0 z-40 border-b border-outline-variant/70 bg-surface/88 backdrop-blur-xl">
      <div className="landing-container flex items-center justify-between gap-4 py-3">
        <Link className="flex min-w-0 items-center gap-3" to="/" onClick={onNavigate}>
          <CompanyLogo className="h-11 w-11 shrink-0 rounded-2xl border border-outline-variant bg-inverse-surface p-2 shadow-[var(--shadow-panel)]" imageClassName="scale-[1.18]" />
          <div className="min-w-0">
            <div className="truncate text-[1.05rem] font-semibold tracking-[-0.04em] text-on-surface">Emergence Devops</div>
            <div className="hidden font-label-sm uppercase tracking-[0.14em] text-on-surface-variant sm:block">Engineering delivery control room</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <a key={link.href} className="landing-nav-link" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="landing-nav-menu-btn inline-flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface md:hidden"
            onClick={onToggle}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">{mobileOpen ? "close" : "menu"}</span>
          </button>
          <Link className="landing-primary-cta" to="/sign-in">
            Sign in
          </Link>
        </div>
      </div>

      {mobileOpen ? (
        <nav className="landing-nav-mobile border-t border-outline-variant/70 px-4 py-3 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a key={link.href} className="landing-nav-link landing-nav-link--mobile" href={link.href} onClick={onNavigate}>
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function PublicLandingContent() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const capabilitiesReveal = useReveal();
  const workflowReveal = useReveal();
  const coverageReveal = useReveal();
  const ctaReveal = useReveal();

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  return (
    <div className="landing-scroller landing-root h-full min-h-0 overflow-y-auto overflow-x-clip overscroll-y-contain bg-background-alt text-on-surface">
      <LandingNav mobileOpen={mobileNavOpen} onToggle={() => setMobileNavOpen((open) => !open)} onNavigate={closeMobileNav} />

      <main>
        <section className="landing-section landing-hero-section relative">
          <div className="landing-hero-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="landing-container relative grid gap-[var(--space-lg)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center">
            <div className="min-w-0 space-y-[var(--space-md)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest/88 px-3 py-1.5 shadow-[var(--shadow-panel)]">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="font-label-sm uppercase tracking-[0.14em] text-primary">For engineering leads</span>
              </div>

              <div className="space-y-[var(--space-sm)]">
                <h1 className="landing-hero-title text-on-surface">Operate work through shipped code.</h1>
                <p className="landing-hero-copy max-w-2xl text-body-lg text-on-surface-variant">
                  Emergence Devops connects Asana parent tasks, operating boards, GitHub history, tagged pull requests, and delivery analytics so leaders see what is moving and what is still disconnected.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link className="landing-primary-cta landing-primary-cta--hero" to="/sign-in">
                  Open control room
                </Link>
                <a className="landing-secondary-cta landing-secondary-cta--hero" href="#platform">
                  Review surfaces
                </a>
              </div>

              <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                <div className="landing-proof-card min-w-0">
                  <p className="landing-proof-label">Source</p>
                  <p className="landing-proof-value">Asana parent tasks</p>
                </div>
                <div className="landing-proof-card min-w-0">
                  <p className="landing-proof-label">Trace</p>
                  <p className="landing-proof-value">Commits + PRs</p>
                </div>
                <div className="landing-proof-card min-w-0">
                  <p className="landing-proof-label">Readout</p>
                  <p className="landing-proof-value">Coverage + exports</p>
                </div>
              </div>
            </div>

            <LandingHeroGraph />
          </div>
        </section>

        <section aria-label="Platform surfaces" className="border-y border-outline-variant/70 bg-surface-container-lowest/76 py-[var(--space-sm)]">
          <div className="landing-container flex flex-wrap items-center gap-3 text-on-surface-variant">
            <span className="font-label-sm uppercase tracking-[0.14em] text-on-surface">Surfaces</span>
            {platformSurfaces.map((item) => (
              <span key={item} className="landing-proof-pill">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section id="platform" className="landing-section landing-anchor">
          <div className="landing-container">
            <div className="landing-section-head">
              <h2 className="landing-section-title">Built from the operational surfaces already in the app.</h2>
              <p className="landing-section-copy">
                Each capability maps to a real workflow inside Emergence Devops — boards, repositories, traceability, and analytics — without a parallel product story.
              </p>
            </div>

            <div ref={capabilitiesReveal.ref} className={cn("mt-[var(--space-lg)] grid gap-[var(--space-sm)] lg:grid-cols-2", capabilitiesReveal.className)}>
              {capabilities.map((capability) => (
                <article key={capability.title} className="landing-feature-card min-w-0">
                  <h3 className="landing-feature-title">{capability.title}</h3>
                  <p className="landing-feature-copy mt-3">{capability.body}</p>
                  <ul className="mt-[var(--space-sm)] grid gap-2 sm:grid-cols-3">
                    {capability.points.map((point) => (
                      <li key={point} className="landing-feature-point min-w-0">
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-section landing-anchor border-y border-outline-variant/70 bg-surface-container-low/56">
          <div className="landing-container grid gap-[var(--space-lg)] lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] lg:items-start">
            <div className="landing-section-head min-w-0">
              <p className="landing-section-label">Connected workflow</p>
              <h2 className="landing-section-title">From selected work to tagged code to reporting.</h2>
              <p className="landing-section-copy">
                Capture a parent task, operate the board, inspect repository movement, and report on delivery coverage with the same underlying context.
              </p>
            </div>

            <div ref={workflowReveal.ref} className={cn("landing-workflow-rail min-w-0", workflowReveal.className)}>
              {workflowSteps.map((step, index) => (
                <div key={step.id} className="landing-workflow-step min-w-0">
                  <div className="landing-workflow-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="min-w-0">
                    <h3 className="landing-workflow-title">{step.title}</h3>
                    <p className="landing-workflow-copy">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="coverage" className="landing-section landing-anchor">
          <div className="landing-container">
            <div ref={coverageReveal.ref} className={cn("landing-coverage-card min-w-0", coverageReveal.className)}>
              <div className="max-w-2xl space-y-[var(--space-sm)]">
                <p className="landing-section-label">Leadership readout</p>
                <h2 className="landing-section-title">Coverage that points back to source work.</h2>
                <p className="landing-section-copy">
                  Analytics snapshots, coverage views, and downloadable summaries explain what shipped, what is linked, and what still lacks operational context.
                </p>
              </div>

              <div className="grid min-w-0 gap-3 md:grid-cols-3">
                <div className="landing-coverage-metric min-w-0">
                  <p className="landing-proof-label">Coverage view</p>
                  <p className="landing-proof-value">Commit links and completed-card activity</p>
                </div>
                <div className="landing-coverage-metric min-w-0">
                  <p className="landing-proof-label">Flow view</p>
                  <p className="landing-proof-value">Backlog, active, review, done movement</p>
                </div>
                <div className="landing-coverage-metric min-w-0">
                  <p className="landing-proof-label">Exports</p>
                  <p className="landing-proof-value">JSON snapshots and markdown summaries</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--last">
          <div className="landing-container">
            <div ref={ctaReveal.ref} className={cn("landing-cta-panel min-w-0", ctaReveal.className)}>
              <div className="space-y-[var(--space-sm)]">
                <p className="landing-section-label">Ready to enter</p>
                <h2 className="landing-section-title max-w-[14ch]">One view for board, repo, and reporting.</h2>
                <p className="landing-section-copy max-w-2xl">
                  Sign in with your workspace access to move from this overview into the control room your team already uses.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link className="landing-primary-cta landing-primary-cta--hero" to="/sign-in">
                  Sign in
                </Link>
                <a className="landing-secondary-cta landing-secondary-cta--hero" href="#platform">
                  Revisit surfaces
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer border-t border-outline-variant/70 bg-surface-container-lowest/92 py-[var(--space-md)]">
        <div className="landing-container flex flex-col gap-[var(--space-sm)] sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="font-semibold tracking-[-0.03em] text-on-surface">Emergence Devops</div>
            <p className="max-w-xl text-body-md text-on-surface-variant">
              Control-room visibility for boards, repository movement, connected work items, and delivery analytics.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 font-label-sm uppercase tracking-[0.14em] text-on-surface-variant">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
            <Link to="/sign-in">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LandingPage() {
  return <PublicLandingContent />;
}
