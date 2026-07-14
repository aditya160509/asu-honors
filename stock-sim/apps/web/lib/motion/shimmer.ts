import gsap from "gsap";

/**
 * Imperative gradient-sweep shimmer — same visual as the `.skeleton-sweep`
 * CSS animation (app/globals.css), exposed as a GSAP tween for callers that
 * need JS control (e.g. pausing when the tab is hidden).
 */
export function shimmerSweep(target: gsap.TweenTarget) {
  return gsap.fromTo(
    target,
    { backgroundPosition: "-200% 0" },
    { backgroundPosition: "200% 0", duration: 1.6, ease: "power1.inOut", repeat: -1 }
  );
}
