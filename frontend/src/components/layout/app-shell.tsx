import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { SessionCornerHint } from "../ui/loading";
import { GlobalTaskSearch } from "./global-task-search";
import { useIntegrationBootstrap } from "../../hooks/use-integration-bootstrap";
import { useSession } from "../../hooks/use-session";
import { hasOnboardingAppAccess } from "../../lib/onboarding-access";
import { cn } from "../../lib/utils";
import { CompanyLogo } from "../brand/company-logo";
import { ProfileAvatar } from "../ui/profile-avatar";

const devopsNav = [
  { to: "/boards",     label: "Boards",     icon: "dashboard" },
  { to: "/repos",      label: "Repos",      icon: "code" },
  { to: "/work-items", label: "Work Items", icon: "list_alt" },
  { to: "/analytics",  label: "Analytics",  icon: "analytics" },
  { to: "/settings",   label: "Settings",   icon: "settings" },
];

const buildtrackNav = [
  { to: "/requests",  label: "Requests",  icon: "confirmation_number" },
  { to: "/triage",    label: "Triage",    icon: "inbox" },
  { to: "/my-queue",  label: "My Queue",  icon: "checklist" },
  { to: "/sponsor",   label: "Sponsor",   icon: "person_pin" },
  { to: "/admin",     label: "Admin",     icon: "admin_panel_settings" },
];

// Combined for mobile nav (which iterates navItems)
const navItems = [...devopsNav, ...buildtrackNav];

export function AppShell() {
  const { loading, user } = useSession();
  const navigate = useNavigate();
  const integration = useIntegrationBootstrap(!loading && Boolean(user));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!loading && !user) {
    return <Navigate to="/sign-in" replace />;
  }

  const asanaConnected = integration.data?.status.asana.connected === true;
  const showAsanaSetupBanner =
    integration.ready && Boolean(user) && !asanaConnected && !hasOnboardingAppAccess();

  function openRoute(path: string) {
    setMobileNavOpen(false);
    navigate(path);
  }

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased">
      {showAsanaSetupBanner ? (
        <div className="fixed left-0 right-0 top-toolbar-height z-50 flex flex-col items-start gap-2 border-b border-primary-fixed-dim bg-primary-fixed/95 px-3 py-2.5 shadow-[0_10px_28px_color-mix(in_oklch,var(--color-accent)_10%,transparent)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-4 md:left-sidebar-width md:px-gutter md:py-2">
          <p className="font-body-md text-[0.92rem] leading-5 text-on-primary-fixed-variant sm:text-body-md">
            Connect Asana to unlock boards and work items.
          </p>
          <button
            className="shrink-0 rounded-full border border-on-primary-fixed-variant/40 bg-surface-container-lowest/60 px-3 py-1 font-label-md text-label-md text-on-primary-fixed-variant transition-colors hover:bg-primary-fixed-dim"
            onClick={() => openRoute("/onboarding")}
            type="button"
          >
            Continue setup
          </button>
        </div>
      ) : null}

      <header className="fixed left-0 top-0 z-50 w-full border-b border-outline-variant bg-surface/88 shadow-[0_1px_0_color-mix(in_oklch,var(--color-ink)_4%,transparent)] backdrop-blur-xl">
        <div className="flex min-h-toolbar-height flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4 md:px-gutter md:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:gap-gutter">
            <button
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface shadow-sm transition-colors hover:bg-surface-container-low md:hidden"
              onClick={() => setMobileNavOpen((current) => !current)}
              type="button"
            >
              <span className="material-symbols-outlined text-[19px]">{mobileNavOpen ? "close" : "menu"}</span>
            </button>
            <Link className="group flex min-w-0 max-w-[10.5rem] items-center gap-2 truncate text-[1.05rem] font-semibold tracking-[-0.035em] text-on-surface transition-opacity active:opacity-80 sm:max-w-[16rem] sm:text-headline-md" to="/boards">
              <CompanyLogo className="hidden h-8 w-8 shrink-0 rounded-lg border border-outline-variant p-1 shadow-sm sm:flex" imageClassName="scale-[1.55]" />
              <span className="truncate">Emergence Devops</span>
            </Link>
            <GlobalTaskSearch />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-on-surface-variant sm:gap-stack-sm">
            <button
              aria-label="Open setup guide"
              className="cursor-pointer rounded-xl p-2 transition-colors hover:bg-surface-container-low hover:text-on-surface active:opacity-80"
              onClick={() => openRoute("/onboarding")}
              type="button"
            >
              <span className="material-symbols-outlined text-[22px] sm:text-[24px]">help</span>
            </button>
            <button
              aria-label="Open settings"
              className="cursor-pointer rounded-xl p-2 transition-colors hover:bg-surface-container-low hover:text-on-surface active:opacity-80"
              onClick={() => openRoute("/settings?section=account")}
              type="button"
            >
              <span className="material-symbols-outlined text-[22px] sm:text-[24px]">settings</span>
            </button>
            <button
              aria-label="Open profile settings"
              className="ml-0.5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-lowest shadow-sm transition-colors hover:bg-surface-container-low sm:ml-1 sm:h-10 sm:w-10"
              onClick={() => openRoute("/settings?section=account")}
              type="button"
            >
              <ProfileAvatar
                alt={`${user?.name ?? user?.email ?? "Workspace user"} profile`}
                avatarUrl={user?.avatarUrl}
                className="h-full w-full"
                iconClassName="text-on-surface-variant"
              />
            </button>
          </div>
        </div>
      </header>

      {mobileNavOpen ? (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 bg-[color-mix(in_oklch,var(--color-ink)_24%,transparent)] backdrop-blur-sm md:hidden",
            showAsanaSetupBanner ? "top-[calc(var(--spacing-toolbar-height)+4rem)]" : "top-toolbar-height"
          )}
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            className="max-h-full overflow-y-auto border-b border-outline-variant bg-surface-container-low/98 px-4 py-4 shadow-[var(--shadow-popover)] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3 border-b border-outline-variant pb-4">
              <CompanyLogo className="h-12 w-12 shrink-0 rounded-2xl p-1.5 shadow-sm" imageClassName="scale-[1.42]" />
              <div className="min-w-0">
                <div className="truncate font-headline-md text-headline-md tracking-[-0.035em] text-on-surface">Emergence Devops</div>
                <div className="mt-0.5 font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">Command center</div>
              </div>
            </div>

            <ul className="flex flex-col gap-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3 transition-all",
                        isActive
                          ? "bg-[var(--inverse-surface)] text-[var(--inverse-on-surface)] shadow-sm"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      )
                    }
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn("material-symbols-outlined text-[20px]", isActive ? "text-[var(--inverse-on-surface)]" : "text-current")}
                          style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          {item.icon}
                        </span>
                        <span className={cn("font-label-md text-label-md", isActive ? "text-[var(--inverse-on-surface)]" : "text-current")}>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col gap-1 border-t border-outline-variant pt-4">
              <Link className="flex items-center gap-3 rounded-2xl px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface" to="/onboarding" onClick={() => setMobileNavOpen(false)}>
                <span className="material-symbols-outlined text-[18px]">help_outline</span>
                <span className="font-label-md text-label-md">Help</span>
              </Link>
              <a className="flex items-center gap-3 rounded-2xl px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface" href="mailto:support@emergencedevops.local?subject=Emergence%20feedback">
                <span className="material-symbols-outlined text-[18px]">feedback</span>
                <span className="font-label-md text-label-md">Feedback</span>
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        className={cn(
          "fixed left-0 z-40 hidden h-[calc(100dvh-var(--spacing-toolbar-height))] w-sidebar-width flex-col justify-between border-r border-outline-variant bg-surface-container-low/92 shadow-[inset_-1px_0_0_color-mix(in_oklch,white_45%,transparent)] backdrop-blur-xl md:flex",
          showAsanaSetupBanner ? "top-[calc(var(--spacing-toolbar-height)+2.75rem)]" : "top-toolbar-height"
        )}
      >
        <div className="overflow-y-auto">
          {/* DevOps section */}
          <ul className="flex flex-col gap-1 px-stack-sm pt-stack-sm">
            {devopsNav.map((item) => (
              <li key={item.to} className="group cursor-pointer">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all",
                      isActive
                        ? "bg-[var(--inverse-surface)] text-[var(--inverse-on-surface)] shadow-sm"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn("material-symbols-outlined text-[18px]", isActive ? "text-[var(--inverse-on-surface)]" : "text-current")}
                        style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {item.icon}
                      </span>
                      <span className={cn("font-label-md text-label-md", isActive ? "text-[var(--inverse-on-surface)]" : "text-current")}>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* BuildTrack section divider */}
          <div className="mx-stack-sm my-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-outline-variant" />
            <span className="font-label-sm text-[10px] uppercase tracking-[0.08em] text-on-surface-variant opacity-50">BuildTrack</span>
            <div className="h-px flex-1 bg-outline-variant" />
          </div>

          <ul className="flex flex-col gap-1 px-stack-sm pb-stack-sm">
            {buildtrackNav.map((item) => (
              <li key={item.to} className="group cursor-pointer">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all",
                      isActive
                        ? "bg-[var(--inverse-surface)] text-[var(--inverse-on-surface)] shadow-sm"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn("material-symbols-outlined text-[18px]", isActive ? "text-[var(--inverse-on-surface)]" : "text-current")}
                        style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {item.icon}
                      </span>
                      <span className={cn("font-label-md text-label-md", isActive ? "text-[var(--inverse-on-surface)]" : "text-current")}>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <ul className="flex flex-col gap-1 border-t border-outline-variant p-stack-sm">
          <li className="group cursor-pointer">
            <Link className="flex items-center gap-3 rounded-xl px-stack-sm py-2 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface" to="/onboarding">
              <span className="material-symbols-outlined text-[18px]">help_outline</span>
              <span className="font-label-md text-label-md">Help</span>
            </Link>
          </li>
          <li className="group cursor-pointer">
            <a className="flex items-center gap-3 rounded-xl px-stack-sm py-2 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface" href="mailto:support@emergencedevops.local?subject=Emergence%20feedback">
              <span className="material-symbols-outlined text-[18px]">feedback</span>
              <span className="font-label-md text-label-md">Feedback</span>
            </a>
          </li>
        </ul>
      </nav>

      <main
        className={cn(
          "relative min-h-0 bg-background-alt md:ml-sidebar-width",
          showAsanaSetupBanner
            ? "mt-[calc(var(--spacing-toolbar-height)+4rem)] h-[calc(100dvh-var(--spacing-toolbar-height)-4rem)] md:mt-[calc(var(--spacing-toolbar-height)+2.75rem)] md:h-[calc(100dvh-var(--spacing-toolbar-height)-2.75rem)]"
            : "mt-toolbar-height h-[calc(100dvh-var(--spacing-toolbar-height))]"
        )}
      >
        {loading ? <SessionCornerHint /> : null}
        <Outlet />
      </main>
    </div>
  );
}
