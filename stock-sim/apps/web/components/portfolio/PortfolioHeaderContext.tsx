"use client";

import * as React from "react";

export interface RangeDelta {
  /** e.g. "1M change" — the since-when label under the identity-bar value. */
  label: string;
  deltaValue: number;
  deltaPct: number;
}

interface PortfolioHeaderContextValue {
  rangeDelta: RangeDelta | null;
  setRangeDelta: (delta: RangeDelta | null) => void;
}

const PortfolioHeaderContext = React.createContext<PortfolioHeaderContextValue>({
  rangeDelta: null,
  setRangeDelta: () => undefined,
});

/** Lets the Performance tab publish its selected range's delta into the shared
 * identity bar (C0: the headline figure is range-aware on the Performance tab). */
export function PortfolioHeaderProvider({ children }: { children: React.ReactNode }) {
  const [rangeDelta, setRangeDelta] = React.useState<RangeDelta | null>(null);
  const value = React.useMemo(() => ({ rangeDelta, setRangeDelta }), [rangeDelta]);
  return <PortfolioHeaderContext.Provider value={value}>{children}</PortfolioHeaderContext.Provider>;
}

export function usePortfolioHeader(): PortfolioHeaderContextValue {
  return React.useContext(PortfolioHeaderContext);
}
