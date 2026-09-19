import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const VARIANTS = {
  primary:
    "bg-gradient-to-r from-lime-400 to-green-400 text-black shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
  outline:
    "border-2 border-green-500 text-green-700 bg-transparent hover:bg-green-50 active:scale-95",
  ghost: "text-green-700 bg-transparent hover:bg-green-50 active:scale-95",
} as const;

export type PrimaryButtonVariant = keyof typeof VARIANTS;

export interface PrimaryButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Convenience for the common case of a text-only call to action. */
  label?: string;
  children?: ReactNode;
  variant?: PrimaryButtonVariant;
}

/**
 * The oversized call-to-action used on the landing and onboarding screens.
 * Distinct from the shadcn `ui/button`, which is the workhorse everywhere else.
 */
export function PrimaryButton({
  label,
  children,
  variant = "primary",
  className,
  type = "button",
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "w-full max-w-sm transform rounded-3xl px-8 py-4 text-lg font-bold transition-all duration-300 ease-out disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children ?? label}
    </button>
  );
}

export { PrimaryButton as Button };
export default PrimaryButton;
