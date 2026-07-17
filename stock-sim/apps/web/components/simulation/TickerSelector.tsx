"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { useSimState } from "@/lib/api/hooks/useSimulation";
import type { CompanyGridItem } from "@/lib/api/types";

export interface TickerSelectorProps {
  value: string;
  onChange: (ticker: string) => void;
}

export function TickerSelector({ value, onChange }: TickerSelectorProps) {
  const { data: simState } = useSimState();
  const { data: grid } = useMarketGrid(simState?.timeline_id);
  const [query, setQuery] = React.useState(value);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const companies = React.useMemo(() => grid?.companies ?? [], [grid?.companies]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return companies.slice(0, 10);
    const q = query.toUpperCase();
    return companies
      .filter(
        (c) =>
          c.ticker.toUpperCase().includes(q) ||
          c.name.toUpperCase().includes(q)
      )
      .slice(0, 10);
  }, [companies, query]);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  React.useEffect(() => {
    setQuery(value);
  }, [value]);

  function handleSelect(ticker: string) {
    setQuery(ticker);
    setOpen(false);
    onChange(ticker);
  }

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, maxWidth: 240 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 10px",
          background: "var(--mer-surface-2)",
          border: "1px solid var(--mer-stroke-hairline)",
          borderRadius: "var(--mer-radius-sm)",
        }}
      >
        <Search size={13} style={{ color: "var(--mer-ink-tertiary)", flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search ticker..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--mer-ink-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-small)",
            fontWeight: 600,
            letterSpacing: "0.03em",
          }}
        />
      </div>

      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--mer-surface-2)",
            border: "1px solid var(--mer-stroke-emphasis)",
            borderRadius: "var(--mer-radius-sm)",
            boxShadow: "var(--mer-shadow-overlay)",
            maxHeight: 280,
            overflowY: "auto",
            zIndex: 50,
          }}
        >
          {filtered.map((c) => (
            <DropdownItem key={c.ticker} company={c} onSelect={handleSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  company,
  onSelect,
}: {
  company: CompanyGridItem;
  onSelect: (ticker: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(company.ticker)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "8px 10px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        borderBottom: "1px solid var(--mer-stroke-hairline)",
        textAlign: "left",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--mer-surface-3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-small)",
            fontWeight: 700,
            color: "var(--mer-ink-primary)",
          }}
        >
          {company.ticker}
        </span>
        <span
          style={{
            fontSize: "var(--fs-micro)",
            color: "var(--mer-ink-tertiary)",
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {company.name}
        </span>
      </div>
      <span
        className="num"
        style={{
          fontSize: "var(--fs-small)",
          color: "var(--mer-ink-secondary)",
        }}
      >
        ${Number(company.current_price ?? 0).toFixed(2)}
      </span>
    </button>
  );
}
