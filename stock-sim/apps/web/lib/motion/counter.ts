"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { DURATION_SLOW, EASE_OUT_EXPO } from "./tokens";

/** Imperative tween for a plain numeric value — e.g. animating a canvas-drawn number. */
export function animateCounter(
  from: number,
  to: number,
  onUpdate: (value: number) => void,
  opts: gsap.TweenVars = {}
) {
  const state = { value: from };
  return gsap.to(state, {
    value: to,
    duration: DURATION_SLOW,
    ease: EASE_OUT_EXPO,
    onUpdate: () => onUpdate(state.value),
    ...opts,
  });
}

/**
 * React hook: tweens between the previous and next `value` whenever it
 * changes, returning a formatted display string. Safe for TERMINAL surfaces —
 * this is a data-update pattern (price/portfolio-value ticking), not decoration.
 */
export function useAnimatedCounter(
  value: number,
  format: (v: number) => string = (v) => v.toFixed(2)
): string {
  const [display, setDisplay] = useState(() => format(value));
  const prevValue = useRef(value);

  useEffect(() => {
    const state = { value: prevValue.current };
    const tween = gsap.to(state, {
      value,
      duration: DURATION_SLOW,
      ease: EASE_OUT_EXPO,
      onUpdate: () => setDisplay(format(state.value)),
    });
    prevValue.current = value;
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}
