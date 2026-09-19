import type { EnquiryExtract } from "./ai/schema";
import type { PortfolioRecord, Product } from "./data/schemas";

/**
 * Deterministic catalogue matching — no LLM, no embeddings, no pricing.
 * Products and portfolio records are passed in as parameters; this module
 * never imports loaders, so it stays pure and trivially testable.
 *
 * Scores are for RANKING ONLY — they are never shown to users as numbers or
 * percentages. What the user sees are the evidence labels and flags.
 */

/**
 * Product-matching weights, largest to smallest:
 * family match > MOQ compatibility > size fit > positioning fit,
 * plus small bonuses for colour capability and GSM backing the positioning.
 * Invariant: every non-family weight combined (20+15+10+5+4 = 54) is smaller
 * than the family weight (100), so a family the customer never asked for can
 * never outrank an asked-family match.
 */
export const WEIGHTS = {
  /** Product is in a family the customer asked for. */
  family: 100,
  /** MOQ is compatible with the requested quantity (violation scores 0 + a flag). */
  moq: 20,
  /** A stated size matches one of the product's catalogue sizes. */
  size: 15,
  /** Extract positioning tier exactly matches the product's GSM tier. */
  positioning: 10,
  /** Positioning tier is one step off (e.g. "premium" asked, "balanced" product). */
  positioningAdjacent: 3,
  /** Stated colour count fits within the product's maxColors. */
  colours: 4,
  /** Extra credit on an exact positioning tier — the GSM backs the tier up. */
  gsmBonus: 5,
} as const;

/**
 * Similar-jobs weights for portfolio records. Family overlap (shared product
 * families) leads, then location (exact city > region), then industry
 * (exact > twin line of work > broad neighbour).
 * Exact city match always wins over the region fallback.
 */
export const SIMILAR_JOB_WEIGHTS = {
  /** Per product family shared with the extract. */
  familyOverlap: 8,
  /** Record is from the customer's exact city. */
  city: 10,
  /** Record is from the same region (state) per CITY_REGIONS. */
  region: 4,
  /** Record's industry equals the extract industry. */
  industry: 6,
  /** Record's industry is the same trade in different clothes (see INDUSTRY_TWINS). */
  twinIndustry: 5,
  /** Record's industry is a close neighbour of the extract industry. */
  relatedIndustry: 3,
} as const;

/**
 * Pairs of industries that are near-identical lines of work — a saree
 * boutique and a women's tailoring shop buy almost the same packaging.
 * Keep tiny; only add a pair when the two trades really are the same buyer.
 */
const INDUSTRY_TWINS: ReadonlyArray<readonly [string, string]> = [
  ["Saree Boutique", "Women's Tailoring"],
];

/**
 * Tiny, hard-coded city → region map for the "same region" reason.
 * Exact city matches are compared directly and always win over this map.
 * Keep it obviously maintainable: add a line per city, that's it.
 */
const CITY_REGIONS: Readonly<Record<string, string>> = {
  // Tamil Nadu
  chennai: "Tamil Nadu",
  coimbatore: "Tamil Nadu",
  erode: "Tamil Nadu",
  madurai: "Tamil Nadu",
  salem: "Tamil Nadu",
  tirupur: "Tamil Nadu", // portfolio spelling
  tiruppur: "Tamil Nadu", // alternate spelling
  // Karnataka
  bangalore: "Karnataka",
  bengaluru: "Karnataka",
  mysore: "Karnataka",
};

/** Region for a city name, or null if it is outside the tiny map. */
function regionOfCity(city: string): string | null {
  return CITY_REGIONS[city.trim().toLowerCase()] ?? null;
}

/**
 * Industries that are close lines of work — used for a small "related
 * industry" credit. Miscellaneous is deliberately left out (matches nothing).
 */
const INDUSTRY_NEIGHBOURS: ReadonlyArray<readonly string[]> = [
  ["Saree Boutique", "Women's Tailoring", "Menswear", "Kids"],
  ["Jewelry", "Cosmetics & Accessories"],
  ["Food (Non-direct / Cafe)", "Gifting & Events"],
  ["D2C / E-commerce", "Mobile Shops", "Stationery", "Opticals"],
];

function industriesRelated(a: string, b: string): boolean {
  return INDUSTRY_NEIGHBOURS.some((group) => group.includes(a) && group.includes(b));
}

function industriesTwin(a: string, b: string): boolean {
  return INDUSTRY_TWINS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export type MatchEvidenceKind =
  | "size"
  | "moq"
  | "gsm"
  | "colours"
  | "positioning"
  | "family"
  | "city"
  | "lead-time"
  | "material";

export interface MatchEvidence {
  /** Machine-checkable citation of the real spec fields behind the claim. */
  fact: string;
  kind: MatchEvidenceKind;
  /** Human-ready line for direct display. */
  label: string;
}

export interface Recommendation {
  product: Product;
  /** Ranking weight only — never surfaced as a number or percentage. */
  score: number;
  evidence: MatchEvidence[];
  /** Violations (below MOQ, too many colours) — surfaced, never silently dropped. */
  flags: string[];
}

export interface MatchResult {
  recommendations: Recommendation[];
  noMatch: { reason: string; nearestFamilies: string[] } | null;
}

export interface SimilarJob {
  record: PortfolioRecord;
  reasons: string[];
}

/** Parse "8x10x3", "8 × 10 × 3 in", '2x3.5"' … into comparable dimensions. */
function parseDims(raw: string): number[] | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/["″”]/g, "")
    .replace(/\bin\b/g, " ");
  const dims = cleaned
    .split(/[×x*]/)
    .map((part) => Number.parseFloat(part))
    .filter((n) => Number.isFinite(n));
  return dims.length >= 2 ? dims : null;
}

function dimsEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.01);
}

/** GSM tier used to line products up with the extract's positioning. */
type Tier = "premium" | "balanced" | "economy";

function gsmTier(gsm: number): Tier {
  if (gsm >= 230) return "premium";
  if (gsm >= 150) return "balanced";
  return "economy";
}

const TIER_RANK: Record<Tier, number> = { economy: 0, balanced: 1, premium: 2 };

function slugFromHref(href: string): string {
  return href.split("/").filter(Boolean).pop() ?? "";
}

/** Product slug → family map, for reading families out of portfolio hrefs. */
function familyBySlug(products: Product[]): Map<string, string> {
  return new Map(products.map((p) => [p.slug, p.family]));
}

/**
 * Families most used by the extract's industry (and its neighbours) in the
 * portfolio — the "nearest families" offered when nothing in the catalogue
 * matches. Returns [] without a portfolio or an industry.
 */
function nearestFamiliesByIndustry(
  extract: EnquiryExtract,
  products: Product[],
  portfolio?: PortfolioRecord[],
): string[] {
  if (!portfolio?.length || !extract.industry) return [];
  const fams = familyBySlug(products);
  const asked = new Set(extract.families);
  const tally = new Map<string, number>();
  for (const record of portfolio) {
    const relevant =
      record.category === extract.industry || industriesRelated(record.category, extract.industry);
    if (!relevant) continue;
    for (const used of record.productsUsed) {
      const fam = fams.get(slugFromHref(used.href));
      if (fam && !asked.has(fam)) tally.set(fam, (tally.get(fam) ?? 0) + 1);
    }
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([fam]) => fam);
}

function scoreProduct(extract: EnquiryExtract, product: Product): Recommendation {
  const evidence: MatchEvidence[] = [];
  const flags: string[] = [];
  let score = 0;

  // Family — the dominant signal.
  if (extract.families.includes(product.family)) {
    score += WEIGHTS.family;
    evidence.push({
      kind: "family",
      fact: `family ${product.family} is asked for`,
      label: `✓ ${product.familyLabel} — the family you asked for`,
    });
  }

  // MOQ compatibility — violations become flags, never silent drops.
  if (product.moq !== null) {
    if (extract.quantity === null) {
      score += WEIGHTS.moq;
      evidence.push({ kind: "moq", fact: `moq ${product.moq}`, label: `✓ MOQ ${product.moq}` });
    } else if (extract.quantity >= product.moq) {
      score += WEIGHTS.moq;
      evidence.push({
        kind: "moq",
        fact: `moq ${product.moq} ≤ quantity ${extract.quantity}`,
        label: `✓ MOQ ${product.moq} ≤ your ${extract.quantity}`,
      });
    } else {
      flags.push(`needs ${product.moq} min (you asked ${extract.quantity})`);
      evidence.push({
        kind: "moq",
        fact: `moq ${product.moq} > quantity ${extract.quantity}`,
        label: `MOQ ${product.moq} — you asked ${extract.quantity}`,
      });
    }
  }

  // Size fit — compare stated sizes against the catalogue chips verbatim.
  const wanted = extract.sizes
    .map((raw) => ({ raw, dims: parseDims(raw) }))
    .filter((s): s is { raw: string; dims: number[] } => s.dims !== null);
  for (const { raw, dims } of wanted) {
    const hit = product.sizes.find((chip) => {
      const chipDims = parseDims(chip);
      return chipDims !== null && dimsEqual(dims, chipDims);
    });
    if (hit) {
      score += WEIGHTS.size;
      evidence.push({
        kind: "size",
        fact: `size ${hit}`,
        label: extract.usage ? `✓ ${hit} — fits ${extract.usage}` : `✓ ${hit} — matches your ${raw}`,
      });
      break;
    }
  }

  // Positioning fit, backed by the product's actual GSM.
  if (extract.positioning !== null && product.gsm !== null) {
    const tier = gsmTier(product.gsm);
    const want = extract.positioning;
    if (tier === want) {
      score += WEIGHTS.positioning + WEIGHTS.gsmBonus;
      const tierLine =
        want === "premium" ? "premium board" : want === "balanced" ? "balanced mid-weight" : "economy weight";
      evidence.push({
        kind: "gsm",
        fact: `gsm ${product.gsm} (${product.material ?? "material not stated"})`,
        label: `✓ ${product.gsm} GSM ${product.material} — ${tierLine}`,
      });
    } else if (Math.abs(TIER_RANK[tier] - TIER_RANK[want]) === 1) {
      score += WEIGHTS.positioningAdjacent;
      evidence.push({
        kind: "positioning",
        fact: `gsm ${product.gsm} is ${tier}, you implied ${want}`,
        label: `${product.gsm} GSM ${product.material} — close to your ${want} tier`,
      });
    }
  }

  // Colour capability.
  if (extract.colours !== null && product.maxColors !== null) {
    const method = product.printMethod ? ` (${product.printMethod})` : "";
    if (extract.colours <= product.maxColors) {
      score += WEIGHTS.colours;
      evidence.push({
        kind: "colours",
        fact: `colours ${extract.colours} ≤ maxColors ${product.maxColors}${method}`,
        label: `✓ prints up to ${product.maxColors} colours${method} — your ${extract.colours} fit`,
      });
    } else {
      flags.push(`you asked ${extract.colours} colours — this prints up to ${product.maxColors}${method}`);
    }
  }

  // Lead time — informational only; deadline math is not attempted here.
  if (extract.deadlineText !== null && product.leadTime !== null) {
    evidence.push({
      kind: "lead-time",
      fact: `leadTime ${product.leadTime}`,
      label: `lead time ${product.leadTime} — you mentioned: ${extract.deadlineText}`,
    });
  }

  return { product, score, evidence, flags };
}

/**
 * Rank the catalogue against an extract. Asked-family matches always outrank
 * everything else; MOQ/colour violations stay in the list with flags attached.
 * If the extract names no family (or one the catalogue doesn't have), returns
 * noMatch with the nearest families we'd suggest instead.
 */
export function matchProducts(
  extract: EnquiryExtract,
  products: Product[],
  portfolio?: PortfolioRecord[],
): MatchResult {
  const asked = new Set(extract.families);
  const hasFamilyMatch = products.some((p) => asked.has(p.family));

  if (asked.size === 0 || !hasFamilyMatch) {
    return {
      recommendations: [],
      noMatch: {
        reason: "no catalogue match — tell us more",
        nearestFamilies: nearestFamiliesByIndustry(extract, products, portfolio),
      },
    };
  }

  const recommendations = products.map((product) => scoreProduct(extract, product)).sort(
    (a, b) => b.score - a.score || a.product.slug.localeCompare(b.product.slug),
  );
  return { recommendations, noMatch: null };
}

/**
 * Portfolio jobs similar to the extract, with human-readable reasons
 * ("same industry: Saree Boutique", "same city: Coimbatore",
 * "used 2 of the same product families"). Pass `products` to enable the
 * family-overlap signal; without it only industry/city/region reasons appear.
 */
export function similarJobs(
  extract: EnquiryExtract,
  portfolio: PortfolioRecord[],
  limit = 5,
  products?: Product[],
): SimilarJob[] {
  const fams = products ? familyBySlug(products) : null;
  const asked = new Set(extract.families);

  const scored = portfolio.map((record) => {
    let score = 0;
    const reasons: string[] = [];

    if (extract.industry !== null) {
      if (record.category === extract.industry) {
        score += SIMILAR_JOB_WEIGHTS.industry;
        reasons.push(`same industry: ${record.category}`);
      } else if (industriesTwin(record.category, extract.industry)) {
        score += SIMILAR_JOB_WEIGHTS.twinIndustry;
        reasons.push(`related industry: ${record.category}`);
      } else if (industriesRelated(record.category, extract.industry)) {
        score += SIMILAR_JOB_WEIGHTS.relatedIndustry;
        reasons.push(`related industry: ${record.category}`);
      }
    }

    if (extract.city !== null && record.city !== null) {
      if (extract.city.trim().toLowerCase() === record.city.trim().toLowerCase()) {
        score += SIMILAR_JOB_WEIGHTS.city;
        reasons.push(`same city: ${record.city}`);
      } else {
        const wantRegion = regionOfCity(extract.city);
        const recordRegion = regionOfCity(record.city);
        if (wantRegion !== null && wantRegion === recordRegion) {
          score += SIMILAR_JOB_WEIGHTS.region;
          reasons.push(`same region: ${wantRegion}`);
        }
      }
    }

    if (fams) {
      const shared = new Set<string>();
      for (const used of record.productsUsed) {
        const fam = fams.get(slugFromHref(used.href));
        if (fam && asked.has(fam)) shared.add(fam);
      }
      if (shared.size > 0) {
        score += SIMILAR_JOB_WEIGHTS.familyOverlap * shared.size;
        reasons.push(`used ${shared.size} of the same product families`);
      }
    }

    return { record, score, reasons };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.reasons.length - a.reasons.length ||
      a.record.slug.localeCompare(b.record.slug),
  );

  return scored.slice(0, limit).map(({ record, reasons }) => ({ record, reasons }));
}
