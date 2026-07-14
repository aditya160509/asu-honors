import gsap from "gsap";
import { DURATION_BASE, DURATION_SLOW, EASE_OUT_EXPO } from "./tokens";

/** Fade + translateY entrance — marketing-surface use (hero, landing sections). */
export function reveal(target: gsap.TweenTarget, opts: gsap.TweenVars = {}) {
  return gsap.fromTo(
    target,
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration: DURATION_SLOW, ease: EASE_OUT_EXPO, ...opts }
  );
}

/** Staggered reveal for a list of elements (e.g. hero headline words). */
export function revealStagger(targets: gsap.TweenTarget, staggerMs = 30, opts: gsap.TweenVars = {}) {
  return gsap.fromTo(
    targets,
    { opacity: 0, y: 16 },
    {
      opacity: 1,
      y: 0,
      duration: DURATION_BASE * 2,
      ease: EASE_OUT_EXPO,
      stagger: staggerMs / 1000,
      ...opts,
    }
  );
}
