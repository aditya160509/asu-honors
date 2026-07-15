"use client";

import * as React from "react";

/**
 * Shared countdown for "Resend email/code" links (forgot-password + OTP screens).
 * `start()` begins a cooldown; `reset()` clears it (e.g. expired code ⇒ resend now).
 */
export function useResendCooldown(seconds: number) {
  const [remaining, setRemaining] = React.useState(0);

  React.useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 1 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps -- interval only needs to exist while counting

  const start = React.useCallback(() => setRemaining(seconds), [seconds]);
  const reset = React.useCallback(() => setRemaining(0), []);

  const label = `0:${String(remaining).padStart(2, "0")}`;

  return { remaining, isCoolingDown: remaining > 0, label, start, reset };
}
