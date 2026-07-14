import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
          hover: "var(--bg-hover)",
        },
        border: {
          DEFAULT: "var(--border)",
          light: "var(--border-light)",
          "mer-hairline": "var(--mer-stroke-hairline)",
          "mer-emphasis": "var(--mer-stroke-emphasis)",
          "mer-accent": "var(--mer-stroke-accent)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          link: "var(--text-link)",
        },
        positive: {
          DEFAULT: "var(--positive)",
          dim: "var(--positive-dim)",
        },
        negative: {
          DEFAULT: "var(--negative)",
          dim: "var(--negative-dim)",
        },
        neutral: "var(--neutral)",
        accent: {
          DEFAULT: "var(--accent)",
          dim: "var(--accent-dim)",
        },
        warning: "var(--warning)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        input: "var(--input)",
        ring: "var(--ring)",
        mkt: {
          "bg-void": "var(--mkt-bg-void)",
          "bg-elevated": "var(--mkt-bg-elevated)",
          "text-hero": "var(--mkt-text-hero)",
          "text-muted": "var(--mkt-text-muted)",
          "text-desat": "var(--mkt-text-desat)",
          signature: "var(--mkt-signature)",
          "signature-dim": "var(--mkt-signature-dim)",
          action: "var(--mkt-action-hue)",
          "action-pressed": "var(--mkt-action-hue-pressed)",
        },
        mer: {
          canvas: "var(--mer-bg-canvas)",
          "surface-1": "var(--mer-surface-1)",
          "surface-2": "var(--mer-surface-2)",
          "surface-3": "var(--mer-surface-3)",
          "surface-4": "var(--mer-surface-4)",
          "ink-primary": "var(--mer-ink-primary)",
          "ink-secondary": "var(--mer-ink-secondary)",
          "ink-tertiary": "var(--mer-ink-tertiary)",
          "accent-500": "var(--mer-accent-500)",
          "accent-600": "var(--mer-accent-600)",
          "accent-300": "var(--mer-accent-300)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        micro: "var(--fs-micro)",
        small: "var(--fs-small)",
        body: "var(--fs-body)",
        base: "var(--fs-base)",
        header: "var(--fs-header)",
        h3: "var(--fs-h3)",
        h2: "var(--fs-h2)",
        h1: "var(--fs-h1)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        7: "var(--space-7)",
        8: "var(--space-8)",
        9: "var(--space-9)",
        10: "var(--space-10)",
        // Rigid 4px baseline grid for the AI-fintech landing direction (LayoutEngine and everything
        // under it) — named separately from the numeric scale above so it can never collide with
        // that scale's key "1" (2px, not a multiple of 4). Every value here is a strict multiple of 4.
        "grid-1": "4px",
        "grid-2": "8px",
        "grid-3": "12px",
        "grid-4": "16px",
        "grid-6": "24px",
        "grid-8": "32px",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
        DEFAULT: "var(--radius)",
        "mer-xs": "var(--mer-radius-xs)",
        "mer-sm": "var(--mer-radius-sm)",
        "mer-md": "var(--mer-radius-md)",
        "mer-lg": "var(--mer-radius-lg)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "glow-accent": "var(--shadow-glow-accent)",
        "glow-positive": "var(--shadow-glow-positive)",
        "glow-negative": "var(--shadow-glow-negative)",
        "mer-rest": "var(--mer-shadow-rest)",
        "mer-raised": "var(--mer-shadow-raised)",
        "mer-overlay": "var(--mer-shadow-overlay)",
        "mer-glow-accent": "var(--mer-glow-accent)",
      },
      transitionTimingFunction: {
        "out-expo": "var(--ease-out-expo)",
        "in-out-smooth": "var(--ease-in-out-smooth)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "400ms",
      },
      backdropBlur: {
        glass: "var(--surface-glass-blur)",
        "mer-glass": "var(--mer-glass-blur)",
      },
    },
  },
  plugins: [],
};

export default config;
