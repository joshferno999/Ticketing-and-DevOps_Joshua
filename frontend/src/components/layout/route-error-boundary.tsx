import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

export function RouteErrorBoundary() {
  const error = useRouteError();

  let title = "Something went wrong";
  let description = "The application hit an unexpected route error.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    description = error.status === 404 ? "That page does not exist. Head back to the board workspace." : error.data?.message ?? description;
  } else if (error instanceof Error) {
    description = error.message;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[var(--shadow-panel)]">
        <p className="font-label-sm text-label-sm uppercase tracking-[0.08em] text-[var(--text-soft)]">Emergence Devops</p>
        <h1 className="mt-2 font-headline-lg text-headline-lg font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</h1>
        <p className="mt-3 font-body-md text-body-md text-[var(--text-muted)]">{description}</p>
        <div className="mt-6 flex gap-3">
          <Link
            to="/boards"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--primary-container)] px-4 font-label-md text-label-md text-[var(--on-primary-container)] transition hover:bg-[var(--inverse-surface)]"
          >
            Open boards
          </Link>
          <Link
            to="/sign-in"
            className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--accent)] px-4 font-label-md text-label-md text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)]"
          >
            Sign in again
          </Link>
        </div>
      </div>
    </div>
  );
}
