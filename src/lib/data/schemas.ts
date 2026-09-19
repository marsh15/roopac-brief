import { z } from "zod";

/**
 * Data contracts for the Roopac snapshot. Every field that the public site
 * does not state is `null` — never a guess. These schemas validate the
 * committed JSON in data/ and are consumed by matching, brief, audit, evals.
 */

export const ProcessStep = z.object({
  num: z.string(), // "01".."04" as printed
  title: z.string(),
  text: z.string(), // verbatim step copy
});
export type ProcessStep = z.infer<typeof ProcessStep>;

export const Turnaround = z.object({
  value: z.string().nullable(), // e.g. "21 days production"
  priority: z.string().nullable(), // e.g. "7 days production"
  note: z.string().nullable(), // e.g. "Shipping time is separate…"
});
export type Turnaround = z.infer<typeof Turnaround>;

export const Product = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string().url(),
  family: z.string(), // e.g. "paper-bags" (from /category/<family> breadcrumb)
  familyLabel: z.string(), // e.g. "PAPER BAGS"
  tagline: z.string().nullable(),
  description: z.string(),
  material: z.string().nullable(),
  thickness: z.string().nullable(), // raw, e.g. "150 GSM" / "51 microns"
  gsm: z.number().nullable(),
  sizes: z.array(z.string()), // raw chips, e.g. "10 × 14 × 4 in"
  printMethod: z.string().nullable(), // e.g. "Offset"
  printOptions: z.array(z.string()), // e.g. ["Single Colour","Two Colour","Full Colour (CMYK)"]
  maxColors: z.number().nullable(),
  moq: z.number().nullable(),
  leadTime: z.string().nullable(), // e.g. "3 weeks"
  turnaround: Turnaround.nullable(),
  benefits: z.array(z.string()), // verbatim badge labels
  processSteps: z.array(ProcessStep),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
  sourceUrl: z.string().url(),
});
export type Product = z.infer<typeof Product>;

export const PortfolioProductUsed = z.object({
  href: z.string(),
  name: z.string(),
  type: z.string().nullable(),
});
export type PortfolioProductUsed = z.infer<typeof PortfolioProductUsed>;

export const PortfolioRecord = z.object({
  slug: z.string(),
  brandName: z.string(),
  category: z.string(), // industry name, e.g. "Saree Boutique"
  city: z.string().nullable(),
  year: z.number().nullable(),
  shortDescription: z.string().nullable(),
  description: z.string().nullable(),
  caseNumber: z.string().nullable(), // e.g. "Case Study Nº 05"
  productsUsed: z.array(PortfolioProductUsed),
  clientQuote: z.string().nullable(),
  clientQuoteBy: z.string().nullable(),
  outcomeStat: z.string().nullable(),
  outcomeLabel: z.string().nullable(),
  url: z.string().url(), // https://roopac.com/portfolio/<slug>
});
export type PortfolioRecord = z.infer<typeof PortfolioRecord>;

export const SitePage = z.object({
  url: z.string().url(),
  kind: z.enum(["static", "product"]),
  title: z.string().nullable(),
  /** Verbatim visible text segments in document order — the auditor quotes these. */
  segments: z.array(z.string()),
  /** Only for kind === "product": slug of the matching product. */
  productSlug: z.string().nullable(),
  snapshotDate: z.string(), // ISO date of the crawl
});
export type SitePage = z.infer<typeof SitePage>;

export const FindingSource = z.object({
  url: z.string().url(),
  quote: z.string(),
});
export type FindingSource = z.infer<typeof FindingSource>;

export const Finding = z.object({
  type: z.string(), // "print-method" | "turnaround" | ...
  severity: z.enum(["high", "medium", "low"]),
  title: z.string(),
  sources: z.array(FindingSource),
  explanation: z.string(),
});
export type Finding = z.infer<typeof Finding>;

export const ProductsFile = z.object({
  snapshotDate: z.string(),
  source: z.literal("https://roopac.com"),
  products: z.array(Product),
});
export const PortfolioFile = z.object({
  snapshotDate: z.string(),
  source: z.literal("https://roopac.com"),
  records: z.array(PortfolioRecord),
});
export const PagesFile = z.object({
  snapshotDate: z.string(),
  source: z.literal("https://roopac.com"),
  pages: z.array(SitePage),
});
export const FindingsFile = z.object({
  generatedAt: z.string(),
  findings: z.array(Finding),
});

/** Roopac industries — the distinct portfolio `category` values (verified 2026-09-19). */
export const INDUSTRIES = [
  "Cosmetics & Accessories",
  "D2C / E-commerce",
  "Food (Non-direct / Cafe)",
  "Footwear",
  "Gifting & Events",
  "Healthcare",
  "Jewelry",
  "Kids",
  "Menswear",
  "Miscellaneous",
  "Mobile Shops",
  "Opticals",
  "Saree Boutique",
  "Stationery",
  "Women's Tailoring",
] as const;
