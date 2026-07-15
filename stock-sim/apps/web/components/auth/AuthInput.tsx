"use client";

import * as React from "react";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Extra line under the field that is not an error (e.g. live password hint). */
  hint?: React.ReactNode;
  /** Renders an eye/eye-off visibility toggle; only meaningful for password fields. */
  revealable?: boolean;
  /** Rendered on the same row as the label, right-aligned (e.g. "Forgot password?"). */
  labelAccessory?: React.ReactNode;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  ({ className, label, error, hint, revealable, labelAccessory, type, id, ...props }, ref) => {
    const [revealed, setRevealed] = React.useState(false);
    const reactId = React.useId();
    const inputId = id ?? reactId;
    const errorId = `${inputId}-error`;
    const resolvedType = revealable && type === "password" && revealed ? "text" : type;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {(label || labelAccessory) && (
          <div className="flex items-baseline justify-between px-1">
            {label && (
              <label
                htmlFor={inputId}
                className="text-micro font-medium uppercase tracking-wider text-mkt-text-muted"
              >
                {label}
              </label>
            )}
            {labelAccessory}
          </div>
        )}
        <div className="relative w-full">
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-12 w-full rounded-full border border-white/10 bg-white/5 px-5 text-body text-mkt-text-hero placeholder:text-mkt-text-muted focus:border-mkt-signature focus:outline-none focus:ring-1 focus:ring-mkt-signature disabled:opacity-50",
              revealable && "pr-12",
              error && "border-warning focus:border-warning focus:ring-warning",
              className
            )}
            {...props}
          />
          {revealable && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={revealed ? "Hide password" : "Show password"}
              onClick={() => setRevealed((r) => !r)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-mkt-text-muted hover:text-mkt-text-hero transition-colors"
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error ? (
          <p id={errorId} className="flex items-center gap-1.5 px-1 text-micro text-warning">
            <TriangleAlert size={12} aria-hidden />
            {error}
          </p>
        ) : (
          hint && <div className="px-1 text-micro text-mkt-text-muted">{hint}</div>
        )}
      </div>
    );
  }
);
AuthInput.displayName = "AuthInput";
