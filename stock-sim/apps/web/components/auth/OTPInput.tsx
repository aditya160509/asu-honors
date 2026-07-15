"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const CODE_LENGTH = 6;

interface OTPInputProps {
  value: string;
  onChange: (code: string) => void;
  /** Called once when all 6 digits are filled (auto-submit). */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  /** Briefly flashes the cell borders amber (wrong-code feedback). */
  hasError?: boolean;
  /** Focus the first cell whenever the value is empty (mount + after a wrong-code clear). */
  autoFocusFirst?: boolean;
}

/** Six boxed digit cells with auto-advance, backspace-retreat, and paste distribution. */
export function OTPInput({ value, onChange, onComplete, disabled, hasError, autoFocusFirst }: OTPInputProps) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? "");

  React.useEffect(() => {
    if (autoFocusFirst && value === "" && !disabled) {
      refs.current[0]?.focus();
    }
  }, [autoFocusFirst, value, disabled]);

  function commit(next: string, focusIndex: number | null) {
    onChange(next);
    if (focusIndex !== null) {
      refs.current[Math.min(focusIndex, CODE_LENGTH - 1)]?.focus();
    }
    if (next.length === CODE_LENGTH) {
      onComplete?.(next);
    }
  }

  function handleChange(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) return; // non-numeric input is silently filtered, not an error
    if (clean.length > 1) {
      // Paste (or autofill) — distribute digits starting from the first cell.
      const next = clean.slice(0, CODE_LENGTH);
      commit(next, next.length - 1);
      return;
    }
    // Clamp so a digit typed into a cell beyond the current fill appends contiguously.
    const insertAt = Math.min(index, value.length);
    const next = (value.slice(0, insertAt) + clean + value.slice(insertAt + 1)).slice(0, CODE_LENGTH);
    commit(next, insertAt + 1);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        commit(value.slice(0, index) + value.slice(index + 1), index);
      } else if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index), index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const clean = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (clean) commit(clean, clean.length - 1);
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="6-digit verification code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={CODE_LENGTH}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 w-12 rounded-xl border border-white/10 bg-white/5 text-center font-mono text-lg text-mkt-text-hero",
            "focus:border-mkt-signature focus:outline-none focus:ring-1 focus:ring-mkt-signature",
            "disabled:opacity-40 transition-colors duration-200",
            hasError && "border-warning"
          )}
        />
      ))}
    </div>
  );
}
