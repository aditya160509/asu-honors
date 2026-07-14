"use client";

import * as React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LayoutGrid } from "@/components/marketing/LayoutEngine";
import { ContextualCrosshair } from "@/components/marketing/ContextualCrosshair";
import { ExecutiveTearSheet } from "@/components/marketing/ExecutiveTearSheet";
import { CrossAssetMatrix } from "@/components/marketing/CrossAssetMatrix";
import { OrderTicketMock } from "@/components/marketing/OrderTicketMock";
import { EASE_OUT_EXPO } from "@/lib/motion";
import { useReducedMotion } from "@/lib/marketing/useReducedMotion";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

// Deliberately loose/scattered starting transforms, plus a slight scale-down for a depth cue —
// snapped to (0,0,0,1) on scroll-in.
const LOOSE_START: gsap.TweenVars[] = [
  { x: -40, y: 24, rotate: -3, scale: 0.97 },
  { x: 36, y: -18, rotate: 2.5, scale: 0.97 },
  { x: -20, y: 30, rotate: -1.5, scale: 0.97 },
];

/**
 * "Act II: The Synthesis" — abstract/loose module positions snap instantly
 * into the rigid grid as the user scrolls this section into view. GSAP
 * ScrollTrigger + power4.out only: fast start, hard snap, zero bounce.
 *
 * The mock modules are a visual illustration of the product (like a
 * screenshot), not real functionality — the whole grid is aria-hidden, with
 * a visually-hidden heading standing in for it in the accessibility tree so
 * screen reader users still know what this section is, without encountering
 * inert "Buy"/"Sell" controls that do nothing.
 */
export function DashboardMockSection() {
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const ledgerRef = React.useRef<HTMLDivElement>(null);
  const moduleRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const section = sectionRef.current;
    const modules = moduleRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (!section || modules.length === 0) return;

    if (reduceMotion) {
      gsap.set(modules, { x: 0, y: 0, rotate: 0, scale: 1 });
      if (ledgerRef.current) gsap.set(ledgerRef.current, { scaleX: 1 });
      return;
    }

    modules.forEach((el, i) => gsap.set(el, LOOSE_START[i % LOOSE_START.length]));

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top 75%",
      once: true,
      onEnter: () => {
        if (ledgerRef.current) {
          gsap.fromTo(ledgerRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: EASE_OUT_EXPO });
        }
        gsap.to(modules, {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          duration: 0.5,
          ease: "power4.out", // aggressive snap — fast start, hard stop, no elastic/bounce
          stagger: 0.06,
        });
      },
    });

    return () => {
      trigger.kill();
    };
  }, [reduceMotion]);

  return (
    <section ref={sectionRef} className="px-grid-4 py-grid-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="sr-only">Product preview: institutional dashboard modules (illustrative)</h2>
        <div className="mb-grid-6 flex flex-col gap-grid-2">
          <span aria-hidden="true" className="block text-micro uppercase tracking-wide text-mkt-text-muted">
            Act II — The Synthesis
          </span>
          <div ref={ledgerRef} className="h-px w-16 origin-left bg-gradient-to-r from-transparent via-mkt-action to-transparent" aria-hidden="true" />
        </div>
        <div aria-hidden="true">
          <LayoutGrid columns={12} className="gap-grid-4">
            <div
              ref={(el) => {
                moduleRefs.current[0] = el;
              }}
              className="col-span-full"
            >
              <ContextualCrosshair>
                <ExecutiveTearSheet />
              </ContextualCrosshair>
            </div>
            <div
              ref={(el) => {
                moduleRefs.current[1] = el;
              }}
              className="col-span-full lg:col-span-8"
            >
              <ContextualCrosshair>
                <CrossAssetMatrix />
              </ContextualCrosshair>
            </div>
            <div
              ref={(el) => {
                moduleRefs.current[2] = el;
              }}
              className="col-span-full lg:col-span-4"
            >
              <OrderTicketMock />
            </div>
          </LayoutGrid>
        </div>
      </div>
    </section>
  );
}
