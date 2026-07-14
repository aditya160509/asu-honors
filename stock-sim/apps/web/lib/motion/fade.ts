import gsap from "gsap";
import { DURATION_BASE, EASE_OUT_EXPO } from "./tokens";

export function fadeIn(target: gsap.TweenTarget, opts: gsap.TweenVars = {}) {
  return gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration: DURATION_BASE, ease: EASE_OUT_EXPO, ...opts });
}

export function fadeOut(target: gsap.TweenTarget, opts: gsap.TweenVars = {}) {
  return gsap.to(target, { opacity: 0, duration: DURATION_BASE, ease: EASE_OUT_EXPO, ...opts });
}
