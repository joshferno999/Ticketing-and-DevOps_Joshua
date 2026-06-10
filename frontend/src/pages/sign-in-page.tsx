import { useState } from "react";
import { Navigate } from "react-router-dom";
import { authClient } from "../auth/client";
import { CompanyLogo } from "../components/brand/company-logo";
import { BusyButtonLabel } from "../components/ui/loading";
import { useOnboardingRequirement } from "../hooks/use-onboarding-requirement";
import { useSession } from "../hooks/use-session";
import { api } from "../lib/api";
import { grantOnboardingAppAccess } from "../lib/onboarding-access";
import { requiresAsanaOnboarding } from "../lib/onboarding";

const deliveryStages = ["Branch", "Merge", "Verify", "Release"];

export function SignInPage() {
  const { user, loading } = useSession();
  const onboarding = useOnboardingRequirement(!loading && Boolean(user));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    if (onboarding.loading) {
      return null;
    }

    return <Navigate to={onboarding.requiresOnboarding ? "/onboarding" : "/boards"} replace />;
  }

  function getAuthErrorMessage(cause: unknown) {
    if (cause && typeof cause === "object" && "message" in cause && typeof cause.message === "string") {
      return cause.message;
    }

    return "Authentication could not be completed. Please try again.";
  }

  async function submitEmailAuth() {
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "sign-up") {
        await authClient.signUp.email({
          email,
          password
        });
        window.location.assign("/onboarding");
        return;
      }

      await authClient.signIn.email({
        email,
        password
      });

      const onboardingState = await api.getOnboarding();
      if (onboardingState.asanaConnected) {
        grantOnboardingAppAccess();
      }
      window.location.assign(requiresAsanaOnboarding(onboardingState) ? "/onboarding" : "/boards");
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-stage relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,var(--surface)_0%,var(--background-alt)_52%,var(--surface-container-low)_100%)] p-3 sm:p-gutter">
      <div className="login-dot-field pointer-events-none absolute inset-0" />
      <div className="login-sweep pointer-events-none absolute left-[-6%] top-[10%] h-[28rem] w-[112%] rounded-full" />

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[2.25rem] border border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-popover)] lg:min-h-[42rem] lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.72fr)]">
        <section className="relative min-h-[22rem] overflow-hidden bg-inverse-surface p-6 text-inverse-on-surface sm:p-8 lg:min-h-0">
          <div className="login-orbit pointer-events-none absolute bottom-[-24%] left-[-12%] h-[32rem] w-[32rem] rounded-full opacity-80" />
          <div className="login-grid pointer-events-none absolute inset-0 opacity-70" />
          <div className="login-graph-shell pointer-events-none absolute inset-x-0 bottom-0 top-0 overflow-hidden">
            <svg aria-hidden="true" className="login-graph h-full w-full" viewBox="0 0 760 760" fill="none" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="login-lane-gradient" x1="92" y1="152" x2="666" y2="566" gradientUnits="userSpaceOnUse">
                  <stop stopColor="color-mix(in oklch, var(--inverse-on-surface) 28%, transparent)" />
                  <stop offset="0.44" stopColor="color-mix(in oklch, var(--color-accent) 52%, transparent)" />
                  <stop offset="1" stopColor="color-mix(in oklch, var(--inverse-on-surface) 22%, transparent)" />
                </linearGradient>
                <linearGradient id="login-trace-gradient" x1="144" y1="108" x2="640" y2="532" gradientUnits="userSpaceOnUse">
                  <stop stopColor="color-mix(in oklch, var(--color-accent) 72%, transparent)" />
                  <stop offset="0.48" stopColor="color-mix(in oklch, var(--inverse-on-surface) 72%, transparent)" />
                  <stop offset="1" stopColor="color-mix(in oklch, var(--color-accent) 54%, transparent)" />
                </linearGradient>
                <radialGradient id="login-node-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0) rotate(90) scale(24)">
                  <stop stopColor="color-mix(in oklch, var(--color-accent) 46%, transparent)" />
                  <stop offset="1" stopColor="transparent" />
                </radialGradient>
              </defs>

              <g className="login-graph-depth">
                <path className="login-graph-lane" d="M28 602C96 562 126 500 188 468C246 438 316 442 368 406C420 370 448 298 514 276C576 254 652 272 726 244" />
                <path className="login-graph-lane" d="M58 208C124 236 186 300 250 322C314 344 390 330 444 372C494 410 532 484 610 516C654 534 694 534 732 526" />
                <path className="login-graph-lane" d="M138 96C214 128 258 174 314 228C374 286 432 362 514 394C584 420 654 400 726 420" />
              </g>

              <g className="login-graph-static">
                <path className="login-graph-path login-graph-path--long" d="M68 548C130 500 158 462 224 430C288 398 362 410 422 372C484 332 534 256 622 232" pathLength="100" />
                <path className="login-graph-path login-graph-path--delay" d="M98 182C156 218 190 264 248 302C310 342 390 344 448 384C508 424 560 496 654 516" pathLength="100" />
                <path className="login-graph-path login-graph-path--merge" d="M180 118C242 152 278 194 326 248C372 300 400 334 448 384" pathLength="100" />
                <path className="login-graph-path login-graph-path--merge" d="M448 384C486 418 530 438 584 442C640 446 686 434 730 408" pathLength="100" />
              </g>

              <g className="login-graph-pulses">
                <circle className="login-graph-pulse login-graph-pulse--one" cx="226" cy="428" r="5.5" />
                <circle className="login-graph-pulse login-graph-pulse--two" cx="446" cy="384" r="5.5" />
                <circle className="login-graph-pulse login-graph-pulse--three" cx="620" cy="232" r="5.5" />
              </g>

              <g className="login-graph-nodes">
                <g className="login-graph-node login-graph-node--one">
                  <circle className="login-graph-node-glow" cx="180" cy="118" r="26" />
                  <circle className="login-graph-node-ring" cx="180" cy="118" r="11" />
                  <circle className="login-graph-node-core" cx="180" cy="118" r="4.5" />
                </g>
                <g className="login-graph-node login-graph-node--two">
                  <circle className="login-graph-node-glow" cx="226" cy="428" r="26" />
                  <circle className="login-graph-node-ring" cx="226" cy="428" r="11" />
                  <circle className="login-graph-node-core" cx="226" cy="428" r="4.5" />
                </g>
                <g className="login-graph-node login-graph-node--three">
                  <circle className="login-graph-node-glow" cx="446" cy="384" r="30" />
                  <circle className="login-graph-node-ring login-graph-node-ring--accent" cx="446" cy="384" r="13" />
                  <circle className="login-graph-node-core login-graph-node-core--accent" cx="446" cy="384" r="5" />
                </g>
                <g className="login-graph-node login-graph-node--four">
                  <circle className="login-graph-node-glow" cx="620" cy="232" r="24" />
                  <circle className="login-graph-node-ring" cx="620" cy="232" r="10" />
                  <circle className="login-graph-node-core" cx="620" cy="232" r="4.5" />
                </g>
                <g className="login-graph-node login-graph-node--five">
                  <circle className="login-graph-node-glow" cx="654" cy="516" r="24" />
                  <circle className="login-graph-node-ring" cx="654" cy="516" r="10" />
                  <circle className="login-graph-node-core" cx="654" cy="516" r="4.5" />
                </g>
              </g>

              <g className="login-release-lanes">
                <rect className="login-release-lane" x="492" y="170" width="152" height="34" rx="17" />
                <rect className="login-release-lane login-release-lane--delay" x="546" y="500" width="122" height="32" rx="16" />
                <rect className="login-release-lane login-release-lane--delay-2" x="96" y="516" width="136" height="32" rx="16" />
              </g>

              <g className="login-release-markers">
                <circle className="login-release-marker login-release-marker--one" cx="526" cy="187" r="4" />
                <circle className="login-release-marker login-release-marker--two" cx="552" cy="187" r="4" />
                <circle className="login-release-marker login-release-marker--three" cx="578" cy="187" r="4" />
                <circle className="login-release-marker login-release-marker--four" cx="604" cy="187" r="4" />
                <circle className="login-release-marker login-release-marker--five" cx="630" cy="187" r="4" />
              </g>
            </svg>
          </div>
          <div className="pointer-events-none absolute right-6 top-6 hidden h-28 w-28 rounded-full border border-inverse-on-surface/10 sm:block" />

          <div className="relative z-10 flex h-full min-h-[22rem] flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <CompanyLogo className="login-logo h-16 w-16 rounded-3xl border border-inverse-on-surface/10 p-2 shadow-[0_20px_60px_color-mix(in_oklch,var(--color-ink)_34%,transparent)]" imageClassName="scale-[1.25]" />
              <div className="hidden rounded-full border border-inverse-on-surface/10 px-3 py-1.5 font-label-sm text-label-sm uppercase tracking-[0.14em] text-inverse-on-surface/54 sm:block">
                Secure workspace
              </div>
            </div>

            <div className="mt-12 max-w-2xl lg:mt-0">
              <div className="mb-4 flex flex-wrap gap-2 font-label-sm text-label-sm uppercase tracking-[0.12em] text-inverse-on-surface/54">
                {deliveryStages.map((word, index) => (
                  <span className="login-glyph rounded-full border border-inverse-on-surface/10 bg-inverse-on-surface/5 px-3 py-1.5" style={{ animationDelay: `${index * 120}ms` }} key={word}>
                    {word}
                  </span>
                ))}
              </div>
              <h1 className="max-w-[12ch] text-[clamp(3.2rem,9vw,7.8rem)] font-semibold leading-[0.82] tracking-[-0.085em]">
                Every change ships through one clear lane.
              </h1>
            </div>

            <div className="relative mt-12 grid max-w-xl gap-3 text-body-md text-inverse-on-surface/72 sm:grid-cols-[1fr_auto] sm:items-end">
              <p className="rounded-3xl border border-inverse-on-surface/10 bg-inverse-on-surface/[0.045] p-4 backdrop-blur">
                Authenticate once and keep GitHub traceability, deployment context, and Asana delivery work moving through the same release graph.
              </p>
              <div className="font-label-sm uppercase tracking-[0.14em] text-inverse-on-surface/48">Emergence Devops</div>
            </div>
          </div>
        </section>

        <section className="relative flex flex-col justify-center gap-6 p-5 sm:gap-margin sm:p-margin lg:p-10">
          <div className="absolute right-6 top-6 hidden h-2 w-24 rounded-full bg-[linear-gradient(90deg,var(--color-accent),transparent)] opacity-45 sm:block" />
          <div>
            <p className="mb-3 font-label-sm text-label-sm uppercase tracking-[0.14em] text-primary">Access Control</p>
            <h2 className="mb-stack-sm font-headline-lg text-headline-lg tracking-[-0.045em] text-on-surface">Sign in to the control room</h2>
            <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">Use your workspace account to access boards, repository mappings, and integration settings.</p>
          </div>

          {error ? <div className="rounded-2xl border border-error bg-error-container px-stack-sm py-stack-sm text-body-md leading-6 text-on-error-container">{error}</div> : null}

          <form className="flex flex-col gap-stack-md" onSubmit={(event) => event.preventDefault()}>
            <div className="flex flex-col gap-base">
              <label className="font-label-md text-label-md text-on-surface" htmlFor="email">
                Email Address
              </label>
              <input
                className="h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md text-body-md text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
                id="email"
                placeholder="name@company.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-base">
              <label className="font-label-md text-label-md text-on-surface" htmlFor="password">
                Password
              </label>
              <input
                className="h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md text-body-md text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
                id="password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <button
              className="mt-stack-sm h-11 w-full cursor-pointer rounded-xl bg-primary-container font-label-md text-label-md text-on-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-inverse-surface hover:shadow-[var(--shadow-panel)] active:translate-y-0 disabled:cursor-wait disabled:opacity-70"
              type="button"
              onClick={submitEmailAuth}
              disabled={submitting}
            >
              <BusyButtonLabel busy={submitting} busyLabel={mode === "sign-up" ? "Creating account" : "Signing in"}>
                {mode === "sign-up" ? "Create Account" : "Sign In"}
              </BusyButtonLabel>
            </button>
          </form>

          <div className="mt-stack-sm text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              {mode === "sign-up" ? "Already have an account?" : "Need an account?"}{" "}
              <button className="font-label-md text-label-md text-primary hover:underline" type="button" onClick={() => setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"))}>
                {mode === "sign-up" ? "Sign in" : "Create account"}
              </button>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
