import { cva, type VariantProps } from "class-variance-authority";
import type { PropsWithChildren } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 font-label-sm text-label-sm font-semibold leading-[14px] tracking-[0.02em]", {
  variants: {
    variant: {
      default: "border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--text-muted)]",
      success: "border-transparent bg-[var(--color-success-soft)] text-[var(--color-success)]",
      warning: "border-transparent bg-[var(--color-warning-soft)] text-[var(--on-tertiary-container)]",
      danger: "border-transparent bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
      info: "border-transparent bg-[var(--color-info-soft)] text-[var(--color-info)]"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export function Badge({ children, className, variant }: PropsWithChildren<{ className?: string } & VariantProps<typeof badgeVariants>>) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}
