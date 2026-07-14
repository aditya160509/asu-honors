"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, debounce } from "@/lib/utils";

/**
 * Consolidates the search-box pattern duplicated across MarketGrid/NewsFeed/
 * CommandPalette: leading icon + optional debounce + clear button.
 */
export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Debounce the onValueChange call (ms). Omit for immediate/controlled updates. */
  debounceMs?: number;
  containerClassName?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onValueChange, debounceMs, containerClassName, className, ...props }, ref) => {
    const [local, setLocal] = React.useState(value);

    const debouncedChange = React.useMemo(
      () => (debounceMs ? debounce(onValueChange, debounceMs) : onValueChange),
      [onValueChange, debounceMs]
    );

    React.useEffect(() => {
      setLocal(value);
    }, [value]);

    return (
      <div className={cn("relative", containerClassName)}>
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <Input
          ref={ref}
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            debouncedChange(e.target.value);
          }}
          className={cn("pl-8", local && "pr-8", className)}
          {...props}
        />
        {local && (
          <button
            type="button"
            onClick={() => {
              setLocal("");
              onValueChange("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";
