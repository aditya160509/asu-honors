"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { cssVar } from "@/lib/utils";
import { useReducedMotion } from "@/lib/marketing/useReducedMotion";

const NUM_STREAMS = 220;
const PARTICLES_PER_STREAM = 14;
const TOTAL_PARTICLES = NUM_STREAMS * PARTICLES_PER_STREAM;
const WORLD_HEIGHT = 20;
const MAX_DELTA = 1 / 20; // clamp so a dropped/backgrounded frame never produces a visible jump — still linear, just bounded

interface StreamField {
  positions: Float32Array;
  colors: Float32Array;
  speeds: Float32Array;
  depths: Float32Array; // 0 (far) .. 1 (near) — a cheap depth cue without a full perspective-camera rewrite
}

function buildField(RED: THREE.Color, GREEN: THREE.Color): StreamField {
  const positions = new Float32Array(TOTAL_PARTICLES * 3);
  const colors = new Float32Array(TOTAL_PARTICLES * 3);
  const speeds = new Float32Array(TOTAL_PARTICLES);
  const depths = new Float32Array(TOTAL_PARTICLES);

  let i = 0;
  for (let s = 0; s < NUM_STREAMS; s++) {
    const x = (s / NUM_STREAMS) * WORLD_HEIGHT * 2 - WORLD_HEIGHT;
    const isGreen = Math.random() > 0.5;
    const color = isGreen ? GREEN : RED;
    const depth = Math.random(); // fixed per-stream so a whole column reads as one depth plane
    const speed = (2 + Math.random() * 6) * (0.5 + depth * 0.7); // nearer streams drift faster — parallax cue

    for (let p = 0; p < PARTICLES_PER_STREAM; p++) {
      const idx = i * 3;
      positions[idx] = x;
      positions[idx + 1] = (p / PARTICLES_PER_STREAM) * WORLD_HEIGHT * 2 - WORLD_HEIGHT;
      positions[idx + 2] = depth * 4 - 2; // z spread, purely for depth-sorted opacity below

      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;

      speeds[i] = speed;
      depths[i] = depth;
      i++;
    }
  }

  return { positions, colors, speeds, depths };
}

function Streams() {
  const colors = React.useMemo(
    () => ({ red: new THREE.Color(cssVar('--negative')), green: new THREE.Color(cssVar('--positive')) }),
    []
  );
  const field = React.useMemo(() => buildField(colors.red, colors.green), [colors]);
  const nearRef = React.useRef<THREE.Points>(null);
  const farRef = React.useRef<THREE.Points>(null);
  const groupRef = React.useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const pointer = React.useRef({ x: 0, y: 0 });
  const scrollFrac = React.useRef(0);

  // Split the shared pool once by depth — two <points> draw calls (near/far), not two full particle
  // systems, so this stays a single geometry build and a fixed, small GPU cost.
  const { nearGeom, farGeom } = React.useMemo(() => {
    const nearIdx: number[] = [];
    const farIdx: number[] = [];
    for (let i = 0; i < TOTAL_PARTICLES; i++) (field.depths[i] > 0.5 ? nearIdx : farIdx).push(i);

    function pick(indices: number[]) {
      const pos = new Float32Array(indices.length * 3);
      const col = new Float32Array(indices.length * 3);
      indices.forEach((srcI, i) => {
        pos.set(field.positions.subarray(srcI * 3, srcI * 3 + 3), i * 3);
        col.set(field.colors.subarray(srcI * 3, srcI * 3 + 3), i * 3);
      });
      return { pos, col, indices };
    }
    return { nearGeom: pick(nearIdx), farGeom: pick(farIdx) };
  }, [field]);

  React.useEffect(() => {
    function rescale(ref: React.RefObject<THREE.Points | null>, indices: number[]) {
      const geom = ref.current?.geometry;
      if (!geom) return;
      const pos = geom.attributes.position as THREE.BufferAttribute;
      indices.forEach((srcI, i) => {
        const stream = Math.floor(srcI / PARTICLES_PER_STREAM);
        pos.setX(i, (stream / NUM_STREAMS) * viewport.width - viewport.width / 2);
      });
      pos.needsUpdate = true;
    }
    rescale(nearRef, nearGeom.indices);
    rescale(farRef, farGeom.indices);
  }, [viewport.width, nearGeom, farGeom]);

  React.useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    }
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollFrac.current = max > 0 ? window.scrollY / max : 0;
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_DELTA);
    const halfHeight = viewport.height / 2 || WORLD_HEIGHT;

    function advance(ref: React.RefObject<THREE.Points | null>, indices: number[]) {
      const geom = ref.current?.geometry;
      if (!geom) return;
      const pos = geom.attributes.position as THREE.BufferAttribute;
      indices.forEach((srcI, i) => {
        let y = pos.getY(i) - field.speeds[srcI] * delta; // linear descent — no easing, no elasticity
        if (y < -halfHeight) y += halfHeight * 2; // hard wrap, not a bounce
        pos.setY(i, y);
      });
      pos.needsUpdate = true;
    }
    advance(nearRef, nearGeom.indices);
    advance(farRef, farGeom.indices);

    // Subtle, whole-scene reactivity — cursor parallax + scroll parallax. Both are gentle group-level
    // offsets, not per-particle physics, so the cost is a couple of lerps per frame, not O(n).
    if (groupRef.current) {
      const targetX = pointer.current.x * 0.4;
      const targetY = -pointer.current.y * 0.25 - scrollFrac.current * 1.2;
      groupRef.current.position.x += (targetX - groupRef.current.position.x) * Math.min(delta * 3, 1);
      groupRef.current.position.y += (targetY - groupRef.current.position.y) * Math.min(delta * 3, 1);
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={farRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[farGeom.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[farGeom.col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.7} sizeAttenuation={false} vertexColors transparent opacity={0.35} />
      </points>
      <points ref={nearRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nearGeom.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[nearGeom.col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={1.1} sizeAttenuation={false} vertexColors transparent opacity={0.9} />
      </points>
    </group>
  );
}

export interface OrderFlowTapeProps {
  className?: string;
}

/**
 * Persistent full-screen WebGL background: an institutional order-book
 * "tape" — hundreds of vertical particle streams, pure red/green, linear
 * motion only, split into two depth planes for parallax. Fixed, negative
 * z-index, pointer-events disabled. Skips mounting the WebGL canvas entirely
 * under prefers-reduced-motion — a static void is a better outcome than a
 * frozen (but still GPU-resident) canvas for that preference.
 */
export function OrderFlowTape({ className }: OrderFlowTapeProps) {
  const reduceMotion = useReducedMotion();
  const containerClass = className ?? "pointer-events-none fixed inset-0 -z-10 bg-mkt-bg-void";

  if (reduceMotion) {
    return <div className={containerClass} aria-hidden="true" />;
  }

  return (
    <div className={containerClass} aria-hidden="true">
      {/* Vignette lives on this inner layer only, so particles fade to the solid black behind them
          (the outer div's bg-mkt-bg-void) rather than to whatever is further back in the stack. */}
      <div
        className="h-full w-full"
        style={{
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 55%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 55%, transparent 100%)",
        }}
      >
        <Canvas
          orthographic
          camera={{ zoom: 40, position: [0, 0, 10] }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          frameloop="always"
        >
          <Streams />
        </Canvas>
      </div>
    </div>
  );
}
