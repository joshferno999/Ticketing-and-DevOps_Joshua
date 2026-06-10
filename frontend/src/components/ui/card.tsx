import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../../lib/utils";

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return (
    <section
      className={cn("rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-panel)]", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <h3 className={cn("text-[20px] font-semibold leading-7 tracking-[-0.025em] text-[var(--text)]", className)}>{children}</h3>;
}

export function CardDescription({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <p className={cn("text-sm leading-5 text-[var(--text-muted)]", className)}>{children}</p>;
}
