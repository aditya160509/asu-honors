import { emptyFilterState } from "@/lib/market/filters";
import { matchSector, sectorToken } from "@/lib/market/sectorAbbrev";
import type { MarketFilterState } from "@/lib/market/types";

/**
 * The command line is the single source of truth for filtering — its raw
 * text is parsed on every keystroke into free-text search + filter tokens +
 * an optional `>command`. The Filter Overlay and saved-screen loads don't
 * hold their own filter state; they read/write this same text, so there is
 * never a second, out-of-sync filter mechanism (Bloomberg-terminal rebuild
 * principle: one command line replaces every other filter chrome).
 */

export const CAP_ALIASES = ["mega", "large", "mid", "small", "micro"] as const;

export interface ParsedToken {
  raw: string;
  key: "cap" | "sector" | "chg" | "price" | "ivgap" | "vol";
  valid: boolean;
  label: string;
}

export interface ParsedCommand {
  name: string;
  args: string;
}

export interface CommandLineResult {
  freeText: string;
  tokens: ParsedToken[];
  filters: MarketFilterState;
  command: ParsedCommand | null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function parseUnitNumber(s: string): number | null {
  const m = s.match(/^([+-]?\d+(?:\.\d+)?)([kmb])?$/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const unit = m[2]?.toLowerCase();
  if (unit === "k") n *= 1e3;
  if (unit === "m") n *= 1e6;
  if (unit === "b") n *= 1e9;
  return n;
}

export function parseCommandLine(raw: string, industries: string[]): CommandLineResult {
  const trimmed = raw.trim();

  if (trimmed.startsWith(">")) {
    const rest = trimmed.slice(1).trim();
    const spaceIdx = rest.indexOf(" ");
    const name = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase();
    const args = spaceIdx === -1 ? "" : rest.slice(spaceIdx + 1).trim();
    return { freeText: "", tokens: [], filters: emptyFilterState(), command: name ? { name, args } : null };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const freeTextParts: string[] = [];
  const tokens: ParsedToken[] = [];
  const filters = emptyFilterState();
  const chgRange: { min?: number; max?: number } = {};
  const priceRange: { min?: number; max?: number } = {};
  const ivgapRange: { min?: number; max?: number } = {};
  const volRange: { min?: number; max?: number } = {};

  for (const part of parts) {
    const capMatch = part.match(/^cap:(.+)$/i);
    const sectorMatch = part.match(/^sector:(.+)$/i);
    const chgGtMatch = part.match(/^chg>([+-]?\d+(?:\.\d+)?)$/i);
    const chgLtMatch = part.match(/^chg<([+-]?\d+(?:\.\d+)?)$/i);
    const priceGtMatch = part.match(/^price>(\d+(?:\.\d+)?)$/i);
    const priceLtMatch = part.match(/^price<(\d+(?:\.\d+)?)$/i);
    const ivgapGtMatch = part.match(/^ivgap>([+-]?\d+(?:\.\d+)?)$/i);
    const ivgapLtMatch = part.match(/^ivgap<([+-]?\d+(?:\.\d+)?)$/i);
    const volGtMatch = part.match(/^vol>(\d+(?:\.\d+)?[kmb]?)$/i);
    const volLtMatch = part.match(/^vol<(\d+(?:\.\d+)?[kmb]?)$/i);

    if (capMatch) {
      const cats = capMatch[1].split(",").map((c) => c.trim().toLowerCase());
      const valid = cats.filter((c) => (CAP_ALIASES as readonly string[]).includes(c));
      if (valid.length > 0) {
        filters.marketCapCategory = Array.from(new Set([...filters.marketCapCategory, ...valid.map(capitalize)]));
        tokens.push({ raw: part, key: "cap", valid: true, label: part });
      } else {
        tokens.push({ raw: part, key: "cap", valid: false, label: part });
      }
    } else if (sectorMatch) {
      const found = matchSector(sectorMatch[1], industries);
      if (found) {
        filters.industries = Array.from(new Set([...filters.industries, found]));
        tokens.push({ raw: part, key: "sector", valid: true, label: part });
      } else {
        tokens.push({ raw: part, key: "sector", valid: false, label: part });
      }
    } else if (chgGtMatch) {
      chgRange.min = parseFloat(chgGtMatch[1]);
      tokens.push({ raw: part, key: "chg", valid: true, label: part });
    } else if (chgLtMatch) {
      chgRange.max = parseFloat(chgLtMatch[1]);
      tokens.push({ raw: part, key: "chg", valid: true, label: part });
    } else if (priceGtMatch) {
      priceRange.min = parseFloat(priceGtMatch[1]);
      tokens.push({ raw: part, key: "price", valid: true, label: part });
    } else if (priceLtMatch) {
      priceRange.max = parseFloat(priceLtMatch[1]);
      tokens.push({ raw: part, key: "price", valid: true, label: part });
    } else if (ivgapGtMatch) {
      ivgapRange.min = parseFloat(ivgapGtMatch[1]);
      tokens.push({ raw: part, key: "ivgap", valid: true, label: part });
    } else if (ivgapLtMatch) {
      ivgapRange.max = parseFloat(ivgapLtMatch[1]);
      tokens.push({ raw: part, key: "ivgap", valid: true, label: part });
    } else if (volGtMatch) {
      const n = parseUnitNumber(volGtMatch[1]);
      if (n != null) {
        volRange.min = n;
        tokens.push({ raw: part, key: "vol", valid: true, label: part });
      } else {
        freeTextParts.push(part);
      }
    } else if (volLtMatch) {
      const n = parseUnitNumber(volLtMatch[1]);
      if (n != null) {
        volRange.max = n;
        tokens.push({ raw: part, key: "vol", valid: true, label: part });
      } else {
        freeTextParts.push(part);
      }
    } else {
      freeTextParts.push(part);
    }
  }

  if (chgRange.min != null || chgRange.max != null) {
    filters.dayChangePct = { min: chgRange.min ?? -Infinity, max: chgRange.max ?? Infinity };
  }
  if (priceRange.min != null || priceRange.max != null) {
    filters.price = { min: priceRange.min ?? 0, max: priceRange.max ?? Infinity };
  }
  if (ivgapRange.min != null || ivgapRange.max != null) {
    filters.ivGapPct = { min: ivgapRange.min ?? -Infinity, max: ivgapRange.max ?? Infinity };
  }
  if (volRange.min != null || volRange.max != null) {
    filters.volume = { min: volRange.min ?? 0, max: volRange.max ?? Infinity };
  }

  return { freeText: freeTextParts.join(" "), tokens, filters, command: null };
}

/** Inverse of parseCommandLine — used when loading a saved screen or an
 * F-key shortcut, so the command line always reflects the true filter
 * state instead of having a second, hidden representation. */
export function filtersToCommandText(filters: MarketFilterState): string {
  const parts: string[] = [];
  if (filters.marketCapCategory.length > 0) {
    parts.push(`cap:${filters.marketCapCategory.map((c) => c.toLowerCase()).join(",")}`);
  }
  for (const ind of filters.industries) parts.push(`sector:${sectorToken(ind)}`);
  if (filters.dayChangePct) {
    if (Number.isFinite(filters.dayChangePct.min)) parts.push(`chg>${filters.dayChangePct.min}`);
    if (Number.isFinite(filters.dayChangePct.max)) parts.push(`chg<${filters.dayChangePct.max}`);
  }
  if (filters.price) {
    if (Number.isFinite(filters.price.min) && filters.price.min > 0) parts.push(`price>${filters.price.min}`);
    if (Number.isFinite(filters.price.max)) parts.push(`price<${filters.price.max}`);
  }
  if (filters.ivGapPct) {
    if (Number.isFinite(filters.ivGapPct.min)) parts.push(`ivgap>${filters.ivGapPct.min}`);
    if (Number.isFinite(filters.ivGapPct.max)) parts.push(`ivgap<${filters.ivGapPct.max}`);
  }
  if (filters.volume) {
    if (Number.isFinite(filters.volume.min) && filters.volume.min > 0) parts.push(`vol>${filters.volume.min}`);
    if (Number.isFinite(filters.volume.max)) parts.push(`vol<${filters.volume.max}`);
  }
  return parts.join(" ");
}

/** Removes every token whose raw text matches, leaving free text and other
 * tokens untouched — used by the status line's click-to-remove. */
export function removeTokenFromText(commandText: string, rawToken: string): string {
  const parts = commandText.split(/\s+/).filter(Boolean);
  return parts.filter((p) => p !== rawToken).join(" ");
}

/** Replaces every token of `key` with a new set of tokens (or removes them
 * if `newTokens` is empty) — used by the Filter Overlay, which edits ranges
 * as a whole rather than one raw token at a time. */
export function upsertTokensOfKey(commandText: string, key: string, newTokens: string[]): string {
  const parts = commandText.split(/\s+/).filter(Boolean);
  const keyPrefixes: Record<string, RegExp> = {
    cap: /^cap:/i,
    sector: /^sector:/i,
    chg: /^chg[<>]/i,
    price: /^price[<>]/i,
    ivgap: /^ivgap[<>]/i,
    vol: /^vol[<>]/i,
  };
  const re = keyPrefixes[key];
  const kept = re ? parts.filter((p) => !re.test(p)) : parts;
  return [...kept, ...newTokens].join(" ").trim();
}
