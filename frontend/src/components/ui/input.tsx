import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--text)] shadow-[inset_0_1px_0_color-mix(in_oklch,white_72%,transparent)] placeholder:text-[var(--text-soft)] transition-[border-color,box-shadow,background] duration-[var(--dur-short)] focus:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
