import gsap from "gsap";
import { DURATION_BASE, EASE_OUT_EXPO } from "./tokens";

type Axis = "x" | "y";

/** Enter animation for drawers/panels — slides in along `axis` while fading in. */
export function panelSlideIn(target: gsap.TweenTarget, axis: Axis = "x", distance = 24, opts: gsap.TweenVars = {}) {
  return gsap.fromTo(
    target,
    { [axis]: distance, opacity: 0 },
    { [axis]: 0, opacity: 1, duration: DURATION_BASE, ease: EASE_OUT_EXPO, ...opts }
  );
}

/** Exit animation for drawers/panels — mirrors panelSlideIn. */
export function panelSlideOut(target: gsap.TweenTarget, axis: Axis = "x", distance = 24, opts: gsap.TweenVars = {}) {
  return gsap.to(target, { [axis]: distance, opacity: 0, duration: DURATION_BASE, ease: EASE_OUT_EXPO, ...opts });
}
