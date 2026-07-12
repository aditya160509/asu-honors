"use client";

import * as React from "react";
import { debounce } from "@/lib/utils";

/** Debounced (200ms) client-side text filter. Caller supplies the predicate. */
export function useGridFilter<T>(data: T[], predicate: (row: T, query: string) => boolean) {
  const [rawQuery, setRawQuery] = React.useState("");
  const [query, setQuery] = React.useState("");

  const debouncedSet = React.useMemo(() => debounce((q: string) => setQuery(q), 200), []);

  const setSearch = React.useCallback(
    (q: string) => {
      setRawQuery(q);
      debouncedSet(q);
    },
    [debouncedSet]
  );

  const filteredData = React.useMemo(() => {
    if (!query.trim()) return data;
    return data.filter((row) => predicate(row, query.trim()));
  }, [data, query, predicate]);

  return { filteredData, query: rawQuery, setSearch };
}
