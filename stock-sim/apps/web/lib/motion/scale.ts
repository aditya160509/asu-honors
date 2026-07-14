import gsap from "gsap";
import { DURATION_BASE, EASE_OUT_EXPO } from "./tokens";

/** Modal/dialog enter animation — scale 0.95 to 1 with a fade. */
export function scaleIn(target: gsap.TweenTarget, opts: gsap.TweenVars = {}) {
  return gsap.fromTo(
    target,
    { opacity: 0, scale: 0.95 },
    { opacity: 1, scale: 1, duration: DURATION_BASE, ease: EASE_OUT_EXPO, ...opts }
  );
}

/** Modal/dialog exit animation — mirrors scaleIn, slightly faster. */
export function scaleOut(target: gsap.TweenTarget, opts: gsap.TweenVars = {}) {
  return gsap.to(target, { opacity: 0, scale: 0.95, duration: DURATION_BASE * 0.75, ease: EASE_OUT_EXPO, ...opts });
}
