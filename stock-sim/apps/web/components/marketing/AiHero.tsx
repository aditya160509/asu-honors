"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { EASE_OUT_EXPO, DURATION_SLOW } from "@/lib/motion";
import { useReducedMotion } from "@/lib/marketing/useReducedMotion";

const COMMAND = "/analyze supply-chain dependencies NVDA";
const CHAR_DURATION = 0.045; // seconds/char — fixed, linear (see typing tween below)

const MOCK_GRID_CELLS = [
  { label: "TSMC", value: 94.2, tone: "positive" as const },
  { label: "FOXCONN", value: -12.6, tone: "negative" as const },
  { label: "ASML", value: 41.8, tone: "positive" as const },
  { label: "SK HYNIX", value: -3.1, tone: "negative" as const },
  { label: "QUALCOMM", value: 18.5, tone: "positive" as const },
  { label: "SAMSUNG", value: 7.9, tone: "positive" as const },
];

const BASE_TILT = { x: 8, y: -10 };
const TILT_RANGE = { x: 5, y: 8 }; // max additional degrees from cursor tracking

/**
 * The hero object is built as a CSS 3D transform (perspective + rotateX/Y),
 * not an embedded Three.js mesh. Rendering live, typed, screen-reader-visible
 * DOM text inside an actual THREE.js scene means routing it through drei's
 * <Html transform> — a known source of text-crispness and hit-testing
 * problems for exactly this kind of content-heavy panel. The page's real
 * WebGL/Three.js requirement is satisfied by <OrderFlowTape> (the full-screen
 * background); this panel gets the isometric glass-slab look via CSS 3D,
 * which is more reliable, more accessible, and cheaper for content this
 * text-dense.
 *
 * The whole panel — command line + mock data grid — is a decorative product
 * illustration, not real functionality or live data, so it's aria-hidden;
 * the real content (headline, subhead, CTA) sits outside it and is fully
 * accessible on its own.
 */
export function AiHero() {
  const typedRef = React.useRef<HTMLSpanElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const ledgerRef = React.useRef<HTMLDivElement>(null);
  const ctaRef = React.useRef<HTMLAnchorElement>(null);
  const cellValueRefs = React.useRef<Map<string, HTMLSpanElement>>(new Map());
  const [typingDone, setTypingDone] = React.useState(false);
  const reduceMotion = useReducedMotion();

  // Ledger-line draw-in under the headline — same GSAP fromTo(scaleX) signature already used on
  // the /market and /dashboard page headers, so this hero shares the app's one signature accent
  // rather than inventing a new one.
  React.useEffect(() => {
    if (!ledgerRef.current) return;
    if (reduceMotion) {
      gsap.set(ledgerRef.current, { scaleX: 1 });
      return;
    }
    gsap.fromTo(ledgerRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.15 });
  }, [reduceMotion]);

  // Typing tween — strict linear timing, no easing.
  React.useEffect(() => {
    if (reduceMotion) {
      if (typedRef.current) typedRef.current.textContent = COMMAND;
      setTypingDone(true);
      return;
    }

    const state = { chars: 0 };
    const tween = gsap.to(state, {
      chars: COMMAND.length,
      duration: COMMAND.length * CHAR_DURATION,
      ease: "none",
      delay: 0.5,
      onUpdate: () => {
        if (typedRef.current) typedRef.current.textContent = COMMAND.slice(0, Math.floor(state.chars));
      },
      onComplete: () => setTypingDone(true),
    });

    return () => {
      tween.kill();
    };
  }, [reduceMotion]);

  // Choreographed grid reveal: y + scale + opacity, then each value counts up from 0 — not a
  // generic opacity fade.
  React.useEffect(() => {
    if (!typingDone || !gridRef.current) return;
    const cells = Array.from(gridRef.current.querySelectorAll<HTMLElement>("[data-grid-cell]"));

    if (reduceMotion) {
      gsap.set(cells, { opacity: 1, y: 0, scale: 1 });
      MOCK_GRID_CELLS.forEach((cell) => {
        const el = cellValueRefs.current.get(cell.label);
        if (el) el.textContent = `${cell.value >= 0 ? "+" : ""}${cell.value.toFixed(1)}%`;
      });
      return;
    }

    gsap.fromTo(
      cells,
      { opacity: 0, y: 10, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: EASE_OUT_EXPO, stagger: 0.06 }
    );

    MOCK_GRID_CELLS.forEach((cell, i) => {
      const el = cellValueRefs.current.get(cell.label);
      if (!el) return;
      const counter = { v: 0 };
      gsap.to(counter, {
        v: cell.value,
        duration: 0.5,
        ease: EASE_OUT_EXPO,
        delay: 0.15 + i * 0.06,
        onUpdate: () => {
          el.textContent = `${counter.v >= 0 ? "+" : ""}${counter.v.toFixed(1)}%`;
        },
      });
    });
  }, [typingDone, reduceMotion]);

  // Cursor-tracked tilt — subtle, clamped, rAF-throttled. Direct style writes, no React state per
  // pointermove, matching the perf discipline already used by ContextualCrosshair.
  React.useEffect(() => {
    if (reduceMotion) return;
    const wrap = wrapRef.current;
    const panel = panelRef.current;
    if (!wrap || !panel) return;
    let raf: number | undefined;

    function onMove(e: PointerEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = undefined;
        const rect = wrap!.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        const rx = BASE_TILT.x - py * TILT_RANGE.x * 2;
        const ry = BASE_TILT.y + px * TILT_RANGE.y * 2;
        panel!.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
    }
    function onLeave() {
      panel!.style.transform = `rotateX(${BASE_TILT.x}deg) rotateY(${BASE_TILT.y}deg)`;
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduceMotion]);

  function handleCtaDown() {
    if (reduceMotion || !ctaRef.current) return;
    gsap.to(ctaRef.current, { scale: 0.97, duration: 0.1, ease: "power1.out" });
  }
  function handleCtaUp() {
    if (reduceMotion || !ctaRef.current) return;
    gsap.to(ctaRef.current, { scale: 1, duration: 0.2, ease: EASE_OUT_EXPO });
  }

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-grid-4 py-grid-8 text-center">
      <h1 className="mkt-headline max-w-5xl text-mkt-text-hero">
        The terminal that reads the market
        <br />
        before you do.
      </h1>
      <div
        ref={ledgerRef}
        aria-hidden="true"
        className="mt-grid-4 h-px w-24 origin-left bg-gradient-to-r from-transparent via-mkt-action to-transparent"
      />
      <p className="mt-grid-4 max-w-xl text-mkt-fs-subhead text-mkt-text-desat">
        AI-driven signal discovery, institutional-grade execution — built on a fully simulated,
        real-math market.
      </p>

      <div ref={wrapRef} className="relative mt-grid-8 w-full max-w-3xl" style={{ perspective: "1400px" }} aria-hidden="true">
        <div
          ref={panelRef}
          className="relative overflow-hidden border border-white/10 bg-white/[0.03] backdrop-blur-xl"
          style={{
            transform: `rotateX(${BASE_TILT.x}deg) rotateY(${BASE_TILT.y}deg)`,
            transformStyle: "preserve-3d",
            transition: "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 4px 24px rgba(0,85,255,0.08)",
          }}
        >
          {/* Wet edge — the specular highlight where light grazes the glass rim */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25" />
          {/* Top-light gradient — the panel catching overhead light, not a flat fill */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" style={{ height: "40%" }} />
          {/* Slow ambient sheen sweep — the one continuous "alive" cue on the glass */}
          {!reduceMotion && <div className="mkt-sheen pointer-events-none absolute inset-0" />}

          {/* AI command line */}
          <div className="relative flex items-center gap-grid-2 border-b border-white/10 px-grid-4 py-grid-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-mkt-action" />
            <span className="num text-small text-mkt-text-muted">$</span>
            <span className="num text-small text-mkt-text-hero" ref={typedRef} />
            <span className="mkt-cursor-blink num text-small text-mkt-action">▍</span>
          </div>

          {/* Glowing data grid — appears once the command finishes typing */}
          <div ref={gridRef} className="relative grid grid-cols-2 gap-px bg-white/5 p-grid-1 sm:grid-cols-3">
            {MOCK_GRID_CELLS.map((cell) => (
              <div
                key={cell.label}
                data-grid-cell
                className="mkt-card-lit flex flex-col gap-grid-1 bg-mkt-bg-void px-grid-4 py-grid-4 opacity-0"
              >
                <span className="text-micro uppercase tracking-wide text-mkt-text-muted">{cell.label}</span>
                <span
                  ref={(el) => {
                    if (el) cellValueRefs.current.set(cell.label, el);
                  }}
                  className={`num text-body font-semibold ${cell.tone === "positive" ? "text-positive" : "text-negative"}`}
                >
                  +0.0%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Link
        ref={ctaRef}
        href="/register"
        className="mkt-action-button mt-grid-8"
        onPointerDown={handleCtaDown}
        onPointerUp={handleCtaUp}
        onPointerLeave={handleCtaUp}
      >
        Request Institutional Access
      </Link>

      <style jsx>{`
        .mkt-cursor-blink {
          animation: mkt-cursor-blink 1s steps(1) infinite;
        }
        @keyframes mkt-cursor-blink {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
        .mkt-sheen {
          background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.05) 50%, transparent 60%);
          background-size: 240% 240%;
          animation: mkt-sheen-sweep 8s linear infinite;
        }
        @keyframes mkt-sheen-sweep {
          0% {
            background-position: 120% 0%;
          }
          100% {
            background-position: -20% 0%;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .mkt-cursor-blink,
          .mkt-sheen {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}
