/**
 * The Tailwind config nests --mer-stroke-* under `theme.colors.border`, which
 * only generates `border-border-mer-hairline`-style classes (Tailwind's
 * nested-key naming), not the shorter `border-mer-hairline` used elsewhere in
 * the shell — that shorter form compiles to no CSS rule at all. Arbitrary-value
 * syntax sidesteps the ambiguity entirely (same technique already used in
 * components/ui/drawer.tsx for --surface-glass-border) and is guaranteed to
 * resolve to the intended custom property regardless of how the color scale
 * is nested in the config.
 */
export const MER_HAIRLINE = "border-[color:var(--mer-stroke-hairline)]";
export const MER_EMPHASIS = "border-[color:var(--mer-stroke-emphasis)]";
export const MER_ACCENT_STROKE = "border-[color:var(--mer-stroke-accent)]";
export const MER_HAIRLINE_BG = "bg-[color:var(--mer-stroke-hairline)]";
export const MER_EMPHASIS_BG = "bg-[color:var(--mer-stroke-emphasis)]";
