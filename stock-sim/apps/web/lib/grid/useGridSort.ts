"use client";

import * as React from "react";
import type { GridColumn, SortDirection, SortState } from "@/lib/grid/types";

/** Click header: asc -> desc -> none. Client-side sort on already-loaded data. */
export function useGridSort<T>(data: T[], columns: GridColumn<T>[]) {
  const [sort, setSort] = React.useState<SortState>({ key: null, direction: null });

  const toggleSort = React.useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      const next: SortDirection = prev.direction === "asc" ? "desc" : prev.direction === "desc" ? null : "asc";
      return { key: next ? key : null, direction: next };
    });
  }, []);

  const sortedData = React.useMemo(() => {
    if (!sort.key || !sort.direction) return data;
    const column = columns.find((c) => c.key === sort.key);
    const accessor = column?.accessor ?? ((row: T) => (row as Record<string, unknown>)[sort.key as string]);
    const dir = sort.direction === "asc" ? 1 : -1;

    return [...data].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      const an = Number(av);
      const bn = Number(bv);
      if (Number.isNaN(an) || Number.isNaN(bn)) return 0;
      return (an - bn) * dir;
    });
  }, [data, columns, sort]);

  return { sortedData, sort, toggleSort };
}
