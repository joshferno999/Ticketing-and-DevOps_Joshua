import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold tracking-[-0.01em] transition-[background,border-color,color,box-shadow,transform,opacity] duration-[var(--dur-short)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] active:translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-[var(--primary-container)] bg-[var(--primary-container)] text-[var(--on-primary-container)] shadow-[0_1px_0_color-mix(in_oklch,var(--color-ink)_12%,transparent),0_10px_24px_color-mix(in_oklch,var(--color-ink)_9%,transparent)] hover:bg-[var(--inverse-surface)]",
        secondary: "border border-[var(--line-strong)] bg-[var(--surface-subtle)] text-[var(--accent-strong)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
        ghost: "border border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
        outline: "border border-[var(--line)] bg-[var(--panel)] text-[var(--text)] shadow-[inset_0_1px_0_color-mix(in_oklch,white_74%,transparent)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 py-1.5 text-[13px]",
        lg: "h-11 px-5 py-2.5"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
