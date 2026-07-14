"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { DURATION_FAST, EASE_OUT_EXPO } from "./tokens";

export interface LiftHandle {
  destroy: () => void;
}

/** Hover lift: translateY on enter/leave. Imperative version for non-React callers. */
export function attachLift(el: HTMLElement, distance = 4): LiftHandle {
  const onEnter = () => gsap.to(el, { y: -distance, duration: DURATION_FAST, ease: EASE_OUT_EXPO });
  const onLeave = () => gsap.to(el, { y: 0, duration: DURATION_FAST, ease: EASE_OUT_EXPO });

  el.addEventListener("mouseenter", onEnter);
  el.addEventListener("mouseleave", onLeave);

  return {
    destroy: () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      gsap.set(el, { clearProps: "transform" });
    },
  };
}

/** React hook wrapper around `attachLift` for a ref'd element. */
export function useLift(ref: RefObject<HTMLElement | null>, distance = 4) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = attachLift(el, distance);
    return () => handle.destroy();
  }, [ref, distance]);
}
