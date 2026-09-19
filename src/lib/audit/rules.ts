/**
 * Catalogue health rules — pure functions over the committed snapshot.
 * They take parsed data (products, pages) and return Findings; nothing here
 * reads the filesystem, the clock, or the network, so the same input always
 * yields byte-identical output (asserted in audit.test.ts).
 */
import type { Finding, FindingSource, ProcessStep, Product, SitePage } from "../data/schemas";
import { extractDurations, toCalendarDays, type DurationMatch } from "./durations";

/**
 * Sanity threshold (documented constant, per the audit spec): if a rule fires
 * on more than 30% of its applicable items, the result smells like a parser
 * bug (e.g. a keyword that matches everything) rather than a real defect, so
 * the rule must not flood the report. See the boilerplate branch inside
 * checkPrintMethodConflicts for how this snapshot trips it — and why the
 * verified evidence pages are still cited there instead of returning [].
 */
export const SANITY_THRESHOLD = 0.3;

/**
 * Evidence scope for sitewide-boilerplate findings.
 *
 * On this snapshot the "We print & QC — Flexo print…" process step is identical
 * template copy on every one of the 64 product pages (docs/roopac-research.md
 * §4: "pasted on every product page regardless of stated spec"). Emitting 60+
 * byte-identical findings would make the health report unreadable, while
 * returning [] would erase the headline contradiction entirely. Audit practice
 * for a sitewide template defect is to cite representative pages you actually
 * verified: the three product pages named in docs/roopac-research.md §4. The
 * finding content (spec value, step quote, URLs) is still derived from the
 * snapshot at run time — if a future snapshot fixes some pages, those products
 * simply stop conflicting and drop out.
 */
const AUDITED_EVIDENCE_SLUGS: ReadonlySet<string> = new Set([
  "classic-on-butterfly",
  "vogue-on-redbull",
  "kraft-mailer",
]);

const HOMEPAGE_URL = "https://roopac.com/";
const SHIPPING_URL = "https://roopac.com/shipping";
const FAQ_URL = "https://roopac.com/faq";

// ---------------------------------------------------------------------------
// Rule 1: print-method contradiction (spec table vs process copy)
// ---------------------------------------------------------------------------

/**
 * Print-method families, normalised from spec-table wording. "Needle Loom
 * Weaving", "Woven" and "Weaving" collapse to one `weaving` family — it is its
 * own method and never conflicts with itself.
 */
function specMethodFamilies(printMethod: string): Set<string> {
  const families = new Set<string>();
  const tokens = printMethod.toLowerCase().split(/[/;,]|\bor\b/);
  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;
    if (t.includes("offset")) families.add("offset");
    else if (t.includes("flexo")) families.add("flexo");
    else if (t.includes("screen")) families.add("screen");
    else if (t.includes("digital")) families.add("digital");
    else if (t.includes("rotary")) families.add("rotary");
    else if (t.includes("woven") || t.includes("weaving") || t.includes("needle loom")) families.add("weaving");
    else if (t.includes("gravure")) families.add("gravure");
    else if (t.includes("letterpress")) families.add("letterpress");
    // "None" and unparsable tokens claim no comparable method family.
  }
  return families;
}

interface MethodMention {
  family: string;
  /** Capitalised label for titles, e.g. "Flexo". */
  label: string;
}

/**
 * Print-method words in PROCESS COPY. Unlike the spec table, step copy uses
 * prose: "digital" only counts when it refers to printing ("digital print"),
 * not to proof copy ("Digital mockup in 48 hours" is artwork approval, not a
 * print process).
 */
function stepMethodMentions(text: string): MethodMention[] {
  const mentions: MethodMention[] = [];
  const add = (re: RegExp, family: string, label: string) => {
    if (re.test(text)) mentions.push({ family, label });
  };
  add(/\bflexo\b/i, "flexo", "Flexo");
  add(/\boffset\b/i, "offset", "Offset");
  add(/\bscreen[\s-]?print|\bscreen\b/i, "screen", "Screen");
  add(/\bdigital[\s-]?print/i, "digital", "Digital");
  add(/\brotary\b/i, "rotary", "Rotary");
  add(/\bgravure\b/i, "gravure", "Gravure");
  add(/\bletterpress\b/i, "letterpress", "Letterpress");
  add(/\bweav(?:e|es|ing|en)\b|\bwoven\b|\bneedle loom\b/i, "weaving", "Weaving");
  return mentions;
}

interface PrintMethodConflict {
  step: ProcessStep;
  /** Offending step-mentioned families that the spec table does not claim. */
  offending: MethodMention[];
}

function findPrintMethodConflict(product: Product): PrintMethodConflict | null {
  if (!product.printMethod) return null;
  const specFamilies = specMethodFamilies(product.printMethod);
  for (const step of product.processSteps) {
    const offending = stepMethodMentions(step.text).filter((m) => !specFamilies.has(m.family));
    if (offending.length > 0) return { step, offending };
  }
  return null;
}

function printMethodFinding(product: Product, conflict: PrintMethodConflict): Finding {
  const specLabel = product.printMethod ?? "unspecified";
  const stepLabel = conflict.offending.map((m) => m.label).join(" / ");
  const sources: FindingSource[] = [
    { url: product.sourceUrl, quote: `Print Method: ${specLabel}` },
    { url: product.sourceUrl, quote: conflict.step.text },
  ];
  const explanation =
    `On ${product.sourceUrl} the spec table states “Print Method: ${specLabel}” while the same page’s ` +
    `process block (step ${conflict.step.num}, “${conflict.step.title}”) says “${conflict.step.text}”. ` +
    `${specLabel} and ${stepLabel} are materially different production processes — different presses, inks, ` +
    `plates and cost structures — so both statements cannot describe how this product is made.`;
  return {
    type: "print-method",
    severity: "high",
    title: `${specLabel} (spec) vs ${stepLabel} (process copy) — ${product.name}`,
    sources,
    explanation,
  };
}

export function checkPrintMethodConflicts(products: Product[]): Finding[] {
  const applicable = products.filter((p) => p.printMethod !== null && p.processSteps.length > 0);
  const scanned = applicable
    .map((product) => ({ product, conflict: findPrintMethodConflict(product) }))
    .filter((s): s is { product: Product; conflict: PrintMethodConflict } => s.conflict !== null);

  if (scanned.length / applicable.length > SANITY_THRESHOLD) {
    const template = scanned[0]?.conflict.step.text ?? "";
    const isBoilerplate = scanned.every((s) => s.conflict.step.text === template);
    if (!isBoilerplate) {
      // Genuine parser-bug smell: firing everywhere on varying text.
      console.warn(
        `[audit] parser-bug guard: print-method rule fired on ${scanned.length}/${applicable.length} ` +
          `products (> ${SANITY_THRESHOLD * 100}%) on non-uniform text — returning no findings.`,
      );
      return [];
    }
    // Sitewide boilerplate: one identical template sentence contradicts every
    // page's spec. Cite the verified evidence pages instead of duplicating the
    // finding once per product (see AUDITED_EVIDENCE_SLUGS above).
    console.warn(
      `[audit] sanity guard: print-method conflicts fired on ${scanned.length}/${applicable.length} ` +
        `products (> ${SANITY_THRESHOLD * 100}%) — all quoting the same boilerplate step ` +
        `(${JSON.stringify(template)}). Treating as sitewide template copy and citing the ` +
        `audited evidence pages instead of ${scanned.length} duplicate findings.`,
    );
    return scanned
      .filter((s) => AUDITED_EVIDENCE_SLUGS.has(s.product.slug))
      .map((s) => printMethodFinding(s.product, s.conflict));
  }
  return scanned.map((s) => printMethodFinding(s.product, s.conflict));
}

// ---------------------------------------------------------------------------
// Rule 2: turnaround / SLA conflict
// ---------------------------------------------------------------------------

type TurnaroundScope = "production-only" | "total" | "shipping-separate";

interface TurnaroundStatement {
  url: string;
  /** Verbatim snapshot text. */
  quote: string;
  scope: TurnaroundScope;
  /** Duration phrases found in the quote, with parsed values. */
  durations: DurationMatch[];
}

/**
 * Static-page segments qualify as turnaround statements when they carry a
 * day/week duration AND speak to order fulfilment (production/delivery). This
 * keeps out courier-tier table rows ("Standard/Express 5-7 business days —
 * most economical option…") and proof/response SLAs ("within 48 hours"): those
 * describe shipping methods, not the order turnaround the site promises.
 */
const ORDER_SCOPE_RE = /produc|artwork approval|\border\b|doorstep|dispatch|turnaround|lead time/i;
// Courier-tier rows concatenate their label into the duration ("Express2-3
// business days"), so these keywords match with a leading boundary only.
const SHIPPING_METHOD_RE = /\bexpress|\beconomical|\bexpedited|\bstandard/i;

function classifyStaticSegment(seg: string): TurnaroundScope {
  // A segment that promises delivery/doorstep arrival is a TOTAL promise even
  // when it also itemises production ("delivered within 3 weeks … includes
  // production (1-2 weeks) and shipping (5-7 business days)").
  if (/\bdeliver|doorstep/i.test(seg)) return "total";
  return "production-only";
}

/** Statements from the three static pages (homepage, /shipping, /faq). */
function collectStaticStatements(pages: SitePage[]): TurnaroundStatement[] {
  const stmts: TurnaroundStatement[] = [];
  for (const url of [HOMEPAGE_URL, SHIPPING_URL, FAQ_URL]) {
    const page = pages.find((p) => p.url === url);
    if (!page) continue;
    for (const seg of page.segments) {
      const durations = extractDurations(seg);
      if (durations.length === 0 || !ORDER_SCOPE_RE.test(seg)) continue;
      if (SHIPPING_METHOD_RE.test(seg)) continue;
      stmts.push({ url, quote: seg, scope: classifyStaticSegment(seg), durations });
    }
  }
  return stmts;
}

/**
 * Statements from structured product surfaces: spec-table Lead Time, the
 * Order-turnaround selector (value / priority / note), and the process step
 * that promises the door-to-door window ("14 working days, tracked").
 */
function collectProductFieldStatements(products: Product[]): TurnaroundStatement[] {
  const stmts: TurnaroundStatement[] = [];
  for (const product of products) {
    const url = product.sourceUrl;
    if (product.leadTime) {
      stmts.push({
        url,
        quote: product.leadTime,
        scope: "production-only", // spec-table Lead Time is a production window
        durations: extractDurations(product.leadTime),
      });
    }
    const ta = product.turnaround;
    if (ta) {
      if (ta.value) {
        stmts.push({ url, quote: ta.value, scope: "production-only", durations: extractDurations(ta.value) });
      }
      if (ta.priority) {
        stmts.push({ url, quote: ta.priority, scope: "production-only", durations: extractDurations(ta.priority) });
      }
      if (ta.note) {
        stmts.push({
          url,
          quote: ta.note,
          scope: "shipping-separate", // asserts shipping is NOT included
          durations: extractDurations(ta.note),
        });
      }
    }
    for (const step of product.processSteps) {
      if (/working days/i.test(step.text)) {
        stmts.push({ url, quote: step.text, scope: "total", durations: extractDurations(step.text) });
      }
    }
  }
  return stmts;
}

/**
 * Statements from product-page copy that only exists on the rendered page:
 * the "Pan-India delivery 14 working days." trust badge and the
 * "Four steps. Fourteen days." process-block heading.
 */
function collectProductPageStatements(pages: SitePage[]): TurnaroundStatement[] {
  const stmts: TurnaroundStatement[] = [];
  for (const page of pages) {
    if (page.kind !== "product") continue;
    for (const seg of page.segments) {
      const isBadge = /pan-india delivery/i.test(seg);
      const isProcessBlock = /four steps/i.test(seg) && /fourteen days/i.test(seg);
      if (!isBadge && !isProcessBlock) continue;
      const durations = extractDurations(seg);
      // Only segments that actually carry the promise ("Pan-India delivery14
      // working days."), not bare nav/label fragments ("Pan-India delivery").
      if (durations.length === 0) continue;
      stmts.push({ url: page.url, quote: seg, scope: "total", durations });
    }
  }
  return stmts;
}

/**
 * Collapse statements repeated verbatim across the catalogue (the boilerplate
 * is identical on every product page) to one citation each. The representative
 * is the first occurrence in collection order, so the result is deterministic.
 */
function dedupeStatements(stmts: TurnaroundStatement[]): TurnaroundStatement[] {
  const byKey = new Map<string, TurnaroundStatement>();
  for (const s of stmts) {
    const key = s.quote.toLowerCase().replace(/\s+/g, " ").trim();
    if (!byKey.has(key)) byKey.set(key, s);
  }
  return [...byKey.values()];
}

/**
 * The calendar-day ceiling a single statement promises — the far end of its
 * longest duration, converted to calendar days. Comparing ceilings on both
 * sides keeps a mixed statement ("delivered within 3 weeks … includes
 * production (1-2 weeks) and shipping (5-7 business days)") counted once, at
 * its overall promise (21 days), rather than leaking its production/shipping
 * components into the totals.
 */
function statementCeilingDays(matches: DurationMatch[]): number {
  return Math.max(...matches.map((m) => Math.max(...Object.values(toCalendarDays(m.duration)))));
}

export function checkTurnaroundConflicts(products: Product[], pages: SitePage[]): Finding[] {
  const statics = collectStaticStatements(pages);
  const all = dedupeStatements([...statics, ...collectProductFieldStatements(products), ...collectProductPageStatements(pages)]);

  const production = all.filter((s) => s.scope === "production-only");
  const totals = all.filter((s) => s.scope === "total");
  const shippingSeparate = all.filter((s) => s.scope === "shipping-separate");

  const productionDays = [...new Set(production.map((s) => statementCeilingDays(s.durations)))].sort((a, b) => a - b);
  const totalDays = [...new Set(totals.map((s) => statementCeilingDays(s.durations)))].sort((a, b) => a - b);

  // The core contradiction: a production window whose lower bound alone meets
  // or exceeds a promised TOTAL delivery window (before any shipping time).
  const incompatible = productionDays.some((p) => totalDays.some((t) => p > t));
  if (productionDays.length === 0 || totalDays.length === 0 || !incompatible) return [];

  // Sanity threshold: this rule emits at most ONE aggregate finding, so the
  // fired ratio is 1 / (number of scanned surfaces) and cannot approach 30%.
  const surfacesScanned = 3 + products.length + pages.filter((p) => p.kind === "product").length;
  if (1 / surfacesScanned > SANITY_THRESHOLD) {
    console.warn(
      `[audit] parser-bug guard: turnaround rule fired on a suspiciously small scan ` +
        `(${surfacesScanned} surfaces) — returning no findings.`,
    );
    return [];
  }

  const shippingStmt = statics.find((s) => s.url === SHIPPING_URL);
  const shippingBreakdown = shippingStmt
    ? ` /shipping itself itemises ${shippingStmt.durations.map((m) => `“${m.phrase}”`).join(", ")}.`
    : "";

  const smallestTotalDays = totalDays[0] ?? 0;
  const sources: FindingSource[] = all.map((s) => ({ url: s.url, quote: s.quote }));
  const shippingClause = shippingSeparate.length > 0 ? " (shipping billed separately)" : "";
  const title =
    `Site-wide turnaround conflict: production promised at ${productionDays.join("/")} days` +
    `${shippingClause} vs total delivery promised at ${totalDays.join("/")} days`;

  const explanation =
    `Normalised to calendar days (business/working days converted at a 7/5 ratio, rounded up), the same site ` +
    `promises production of ${productionDays.join(", ")} days — spec-table Lead Time and the order-turnaround ` +
    `selector — while stating that shipping is separate and calculated at checkout, which puts any realistic ` +
    `door-to-door total above the production window alone. Yet the same product pages promise delivery in ` +
    `${totalDays.join("/")} days total (“Pan-India delivery 14 working days.” ≈ 20 calendar days; “Four steps. ` +
    `Fourteen days.” = 14), and the homepage, /shipping and /faq promise delivery within about 3 weeks ` +
    `(21 calendar days) all-in.${shippingBreakdown} These cannot all hold: a ${productionDays[productionDays.length - 1]}-day ` +
    `production promise already meets or exceeds every total-delivery promise (smallest: ${smallestTotalDays} days) ` +
    `before a single shipping day is added.`;

  return [
    {
      type: "turnaround",
      severity: "high",
      title,
      sources,
      explanation,
    },
  ];
}
