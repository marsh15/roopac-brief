import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseDuration, parseDurationDays, toCalendarDays, extractDurations } from "./durations";
import { checkPrintMethodConflicts, checkTurnaroundConflicts } from "./rules";
import { PagesFile, ProductsFile, type Product } from "../data/schemas";

// The rules operate on the committed snapshot itself (data/*.json); the
// confirmed inconsistencies from docs/roopac-research.md §4 are the acceptance
// criteria — the rules must rediscover them from the data, not repeat them.

const DATA_DIR = new URL("../../../data/", import.meta.url); // src/lib/audit -> <repo>/data
const productsFile = ProductsFile.parse(
  JSON.parse(readFileSync(new URL("products.json", DATA_DIR), "utf8")),
);
const pagesFile = PagesFile.parse(
  JSON.parse(readFileSync(new URL("pages.json", DATA_DIR), "utf8")),
);

function slugOf(findingUrl: string): Product | undefined {
  return productsFile.products.find((p) => p.sourceUrl === findingUrl);
}

describe("parseDuration / parseDurationDays", () => {
  it("parses plain calendar durations", () => {
    expect(parseDurationDays("3 weeks")).toEqual({ minDays: 21, maxDays: 21 });
    expect(parseDurationDays("21 days")).toEqual({ minDays: 21, maxDays: 21 });
    expect(parseDurationDays("7 days")).toEqual({ minDays: 7, maxDays: 7 });
    expect(parseDurationDays("1 week")).toEqual({ minDays: 7, maxDays: 7 });
  });

  it("parses ranges, keeping the range", () => {
    expect(parseDuration("1-2 weeks")).toEqual({ minDays: 7, maxDays: 14, unit: "calendar" });
    expect(parseDurationDays("1-2 weeks")).toEqual({ minDays: 7, maxDays: 14 });
    // en dash and "to" variants
    expect(parseDuration("1–2 weeks")?.maxDays).toBe(14);
    expect(parseDuration("1 to 2 weeks")?.maxDays).toBe(14);
  });

  it("keeps business-day ranges in business units and converts at 7/5 rounded up", () => {
    // "5-7 business days" stays 5..7 BUSINESS days — the range is kept, not collapsed.
    expect(parseDuration("5-7 business days")).toEqual({ minDays: 5, maxDays: 7, unit: "business" });
    // calendar equivalent: ceil(5*7/5)=7 .. ceil(7*7/5)=10
    expect(parseDurationDays("5-7 business days")).toEqual({ minDays: 7, maxDays: 10 });
    // 14 working days ≈ 20 calendar days
    expect(parseDuration("14 working days")).toEqual({ minDays: 14, maxDays: 14, unit: "business" });
    expect(toCalendarDays({ minDays: 14, maxDays: 14, unit: "business" })).toEqual({ minDays: 20, maxDays: 20 });
    expect(parseDurationDays("2-3 business days")).toEqual({ minDays: 3, maxDays: 5 });
  });

  it("parses word numbers (one..thirty)", () => {
    expect(parseDurationDays("Fourteen days")).toEqual({ minDays: 14, maxDays: 14 });
    expect(parseDurationDays("four steps. Fourteen days.")).toEqual({ minDays: 14, maxDays: 14 });
    expect(parseDuration("Twenty-one days")?.minDays).toBe(21);
  });

  it("tolerates hedges: about / within / ~ / up to", () => {
    expect(parseDurationDays("about 3 weeks")).toEqual({ minDays: 21, maxDays: 21 });
    expect(parseDurationDays("within 3 weeks")).toEqual({ minDays: 21, maxDays: 21 });
    expect(parseDurationDays("~3 weeks")).toEqual({ minDays: 21, maxDays: 21 });
    expect(parseDurationDays("up to 2 weeks")).toEqual({ minDays: 14, maxDays: 14 });
  });

  it("extracts every duration phrase from mixed sentences", () => {
    const phrases = extractDurations(
      "Most orders are delivered within 3 weeks of artwork approval — that includes production (1-2 weeks) and shipping (5-7 business days).",
    ).map((m) => m.phrase);
    expect(phrases).toEqual(["within 3 weeks", "1-2 weeks", "5-7 business days"]);
  });

  it("returns null for non-durations (hours are not order turnarounds)", () => {
    expect(parseDurationDays("48 hours")).toBeNull();
    expect(parseDurationDays("We respond in 2 hours.")).toBeNull();
    expect(parseDurationDays("no timing here")).toBeNull();
  });

  it("parses snapshot glue like 'Pan-India delivery14 working days.'", () => {
    expect(parseDurationDays("Pan-India delivery14 working days.")).toEqual({ minDays: 20, maxDays: 20 });
  });
});

describe("checkPrintMethodConflicts", () => {
  it("fires exactly on the three audited products, computed from the snapshot", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const findings = checkPrintMethodConflicts(productsFile.products);
    vi.restoreAllMocks();

    const slugs = new Set(findings.map((f) => slugOf(f.sources[0].url)?.slug));
    expect(slugs).toEqual(new Set(["classic-on-butterfly", "vogue-on-redbull", "kraft-mailer"]));
  });

  it("reports the expected spec-vs-process pairs", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const findings = checkPrintMethodConflicts(productsFile.products);
    vi.restoreAllMocks();

    const bySlug = new Map(findings.map((f) => [slugOf(f.sources[0].url)?.slug, f.title]));
    expect(bySlug.get("classic-on-butterfly")).toContain("Offset (spec) vs Flexo (process copy)");
    expect(bySlug.get("vogue-on-redbull")).toContain("Offset (spec) vs Flexo (process copy)");
    expect(bySlug.get("kraft-mailer")).toContain("Screen (spec) vs Flexo (process copy)");
  });

  it("gives each finding two sources with non-empty verbatim quotes", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const findings = checkPrintMethodConflicts(productsFile.products);
    vi.restoreAllMocks();

    for (const finding of findings) {
      expect(finding.type).toBe("print-method");
      expect(finding.severity).toBe("high");
      expect(finding.sources).toHaveLength(2);
      for (const source of finding.sources) {
        expect(source.quote.trim().length).toBeGreaterThan(0);
        expect(source.url).toMatch(/^https:\/\/roopac\.com\/products\//);
      }
      expect(finding.explanation.trim().length).toBeGreaterThan(0);
    }
  });

  it("does not treat proof copy as a print method", () => {
    // "Digital mockup in 48 hours" is artwork approval, not digital printing —
    // a Digital-spec product must not conflict with it.
    const digital: Product = {
      ...productsFile.products[0],
      slug: "test-digital",
      sourceUrl: "https://roopac.com/products/test-digital",
      printMethod: "Digital",
      processSteps: [
        { num: "01", title: "We send a proof", text: "Digital mockup in 48 hours. Approve or tweak — your call." },
      ],
    };
    expect(checkPrintMethodConflicts([digital])).toEqual([]);
  });

  it("does not conflict Needle Loom Weaving with weaving words", () => {
    const woven: Product = {
      ...productsFile.products[0],
      slug: "test-woven",
      sourceUrl: "https://roopac.com/products/test-woven",
      printMethod: "Needle Loom Weaving",
      processSteps: [{ num: "01", title: "We weave", text: "Needle loom weaving on industrial looms." }],
    };
    expect(checkPrintMethodConflicts([woven])).toEqual([]);
  });
});

describe("checkTurnaroundConflicts", () => {
  const findings = checkTurnaroundConflicts(productsFile.products, pagesFile.pages);

  it("produces exactly one high-severity aggregate finding", () => {
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("turnaround");
    expect(findings[0].severity).toBe("high");
  });

  it("quotes every distinct statement: >=8 sources across homepage/shipping/faq/2+ product pages", () => {
    const sources = findings[0].sources;
    expect(sources.length).toBeGreaterThanOrEqual(8);

    const urls = new Set(sources.map((s) => s.url));
    expect(urls).toContain("https://roopac.com/");
    expect(urls).toContain("https://roopac.com/shipping");
    expect(urls).toContain("https://roopac.com/faq");
    const productUrls = [...urls].filter((u) => u.startsWith("https://roopac.com/products/"));
    expect(productUrls.length).toBeGreaterThanOrEqual(2);

    for (const source of sources) {
      expect(source.quote.trim().length).toBeGreaterThan(0);
    }
  });

  it("captures the confirmed statements verbatim", () => {
    const quotes = findings[0].sources.map((s) => s.quote);
    const joined = quotes.join("\n");
    expect(joined).toContain("about 3 weeks"); // homepage total
    expect(joined).toContain("delivered within 3 weeks"); // /shipping + /faq totals
    expect(joined).toContain("21 days production"); // selector value
    expect(joined).toContain("7 days production"); // selector priority
    expect(joined).toContain("Shipping time is separate"); // shipping excluded
    expect(joined).toContain("Pan-India delivery14 working days."); // trust badge
    expect(joined).toContain("Four steps. Fourteen days."); // process block
    expect(joined).toContain("14 working days, tracked"); // process step 04
    expect(quotes).toContain("3 weeks"); // spec-table Lead Time
  });

  it("explains the conflict with normalised day values", () => {
    const explanation = findings[0].explanation;
    expect(explanation).toMatch(/7\/5/); // business->calendar assumption stated
    for (const day of ["7", "14", "20", "21"]) {
      expect(explanation).toContain(day);
    }
  });
});

describe("determinism", () => {
  it("running the rules twice yields JSON-identical results", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const run1 = [
      ...checkPrintMethodConflicts(productsFile.products),
      ...checkTurnaroundConflicts(productsFile.products, pagesFile.pages),
    ].sort((a, b) => (a.type === b.type ? a.title.localeCompare(b.title) : a.type.localeCompare(b.type)));
    const run2 = [
      ...checkPrintMethodConflicts(productsFile.products),
      ...checkTurnaroundConflicts(productsFile.products, pagesFile.pages),
    ].sort((a, b) => (a.type === b.type ? a.title.localeCompare(b.title) : a.type.localeCompare(b.type)));
    vi.restoreAllMocks();

    expect(JSON.stringify(run2)).toBe(JSON.stringify(run1));
  });
});
