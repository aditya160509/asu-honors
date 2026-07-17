/** Short codes for the 15 industries seeded in this app — used both for the
 * terminal table's compact SECTOR column and for `sector:<code>` command-line
 * tokens. Full industry names contain spaces/slashes, which can't survive as
 * a single whitespace-delimited token, so the grammar matches against these
 * codes/aliases instead of the raw name. */
export const SECTOR_ABBREV: Record<string, { code: string; aliases: string[] }> = {
  "Automobiles & Auto Components": { code: "AUTO", aliases: ["auto"] },
  "Banking & Financial Services": { code: "BANK", aliases: ["bank", "fin"] },
  Chemicals: { code: "CHEM", aliases: ["chem"] },
  "Construction & Infrastructure": { code: "CONS", aliases: ["cons", "infra"] },
  "Energy (Oil & Gas)": { code: "ENGY", aliases: ["engy", "energy", "oil"] },
  "FMCG / Consumer Staples": { code: "FMCG", aliases: ["fmcg", "consumer"] },
  "Industrials & Capital Goods": { code: "INDL", aliases: ["indl", "indus"] },
  "Information Technology / Software": { code: "IT/SW", aliases: ["it", "tech", "software"] },
  "Media & Entertainment": { code: "MEDI", aliases: ["medi", "media"] },
  "Metals & Mining": { code: "METL", aliases: ["metl", "metals", "mining"] },
  "Pharmaceuticals & Healthcare": { code: "PHRM", aliases: ["phrm", "pharma", "health"] },
  "Real Estate": { code: "REAL", aliases: ["real", "realty"] },
  "Retail & E-commerce": { code: "RETL", aliases: ["retl", "retail"] },
  Telecommunications: { code: "TELE", aliases: ["tele", "telecom"] },
  "Utilities (Power/Gas/Water)": { code: "UTIL", aliases: ["util", "utilities"] },
};

const FALLBACK_CODE_CACHE = new Map<string, string>();

/** Compact code for display — falls back to a derived 4-letter code for any
 * industry not in the curated map above, so a future/renamed industry never
 * breaks rendering. */
export function sectorCode(industryName: string): string {
  const known = SECTOR_ABBREV[industryName];
  if (known) return known.code;
  if (FALLBACK_CODE_CACHE.has(industryName)) return FALLBACK_CODE_CACHE.get(industryName)!;
  const firstWord = industryName.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/)[0] ?? industryName;
  const code = firstWord.slice(0, 4).toUpperCase() || "OTH";
  FALLBACK_CODE_CACHE.set(industryName, code);
  return code;
}

/** Finds the full industry name matching a `sector:<query>` token — checks
 * the curated code/aliases first, then falls back to a substring match
 * against the full name for anything not curated. */
export function matchSector(query: string, industries: string[]): string | null {
  const q = query.toLowerCase();
  for (const name of industries) {
    const known = SECTOR_ABBREV[name];
    if (known && (known.code.toLowerCase() === q || known.aliases.includes(q))) return name;
  }
  for (const name of industries) {
    if (sectorCode(name).toLowerCase() === q) return name;
  }
  return industries.find((name) => name.toLowerCase().includes(q)) ?? null;
}

/** Preferred short token for a given industry, used when writing tokens
 * back into the command line (e.g. from the Filter Overlay or a table click). */
export function sectorToken(industryName: string): string {
  const known = SECTOR_ABBREV[industryName];
  return known ? known.aliases[0] : sectorCode(industryName).toLowerCase();
}
