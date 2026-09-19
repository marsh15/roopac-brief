import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchProducts, similarJobs } from "./match";
import { emptyExtract } from "./ai/schema";
import type { EnquiryExtract } from "./ai/schema";
import type { PortfolioRecord, Product } from "./data/schemas";

// Real snapshot data, loaded from disk (tests run against the repo root).
const productsFile = JSON.parse(
  readFileSync(new URL("../../data/products.json", import.meta.url), "utf8"),
) as { products: Product[] };
const portfolioFile = JSON.parse(
  readFileSync(new URL("../../data/portfolio.json", import.meta.url), "utf8"),
) as { records: PortfolioRecord[] };
const products = productsFile.products;
const portfolio = portfolioFile.records;

// "500 premium bags Coimbatore boutique"
const sareeEnquiry: EnquiryExtract = {
  ...emptyExtract,
  industry: "Saree Boutique",
  city: "Coimbatore",
  quantity: 500,
  families: ["paper-bag"],
  positioning: "premium",
};

const REDBULL_PAPER_BAGS = ["classic-on-redbull", "sprout-on-redbull", "vogue-on-redbull"];

describe("matchProducts", () => {
  it("ranks all three RedBull paper bags in the top 3 for the premium Coimbatore enquiry", () => {
    const { recommendations, noMatch } = matchProducts(sareeEnquiry, products);
    expect(noMatch).toBeNull();
    const top3 = recommendations.slice(0, 3).map((r) => r.product.slug);
    // Set intersection, not exact order: all three RedBull-handle bags on top.
    expect(top3.filter((slug) => REDBULL_PAPER_BAGS.includes(slug))).toHaveLength(3);
  });

  it("keeps a below-MOQ product in the list with a flag, never drops it", () => {
    const extract: EnquiryExtract = { ...emptyExtract, quantity: 150, families: ["paper-bag"] };
    const { recommendations, noMatch } = matchProducts(extract, products);
    expect(noMatch).toBeNull();
    const butterfly = recommendations.find((r) => r.product.slug === "classic-on-butterfly");
    expect(butterfly).toBeDefined(); // MOQ 300 vs quantity 150 — still recommended
    expect(butterfly!.flags.some((f) => f.includes("300"))).toBe(true);
    expect(butterfly!.evidence.length).toBeGreaterThan(0);
  });

  it("fits size 8x10x3 to Sprout better than Vogue, with size evidence", () => {
    const extract: EnquiryExtract = { ...emptyExtract, families: ["paper-bag"], sizes: ["8x10x3"] };
    const { recommendations } = matchProducts(extract, products);
    const sprout = recommendations.find((r) => r.product.slug === "sprout-on-redbull")!;
    const vogue = recommendations.find((r) => r.product.slug === "vogue-on-redbull")!;
    expect(recommendations.indexOf(sprout)).toBeLessThan(recommendations.indexOf(vogue));
    const sizeEvidence = sprout.evidence.find((e) => e.kind === "size");
    expect(sizeEvidence?.label).toContain("8 × 10 × 3 in");
    expect(vogue.evidence.some((e) => e.kind === "size")).toBe(false); // 16 × 13 × 5 in ≠ 8x10x3
  });

  it("never ranks a non-asked family above an asked-family product with compatible MOQ", () => {
    const { recommendations } = matchProducts(sareeEnquiry, products);
    const lastAsked = recommendations.reduce(
      (last, r, i) => (r.product.family === "paper-bag" ? i : last),
      -1,
    );
    const firstOther = recommendations.reduce(
      (first, r, i) => (r.product.family !== "paper-bag" && i < first ? i : first),
      Number.POSITIVE_INFINITY,
    );
    expect(lastAsked).toBeGreaterThanOrEqual(0);
    expect(firstOther).toBeGreaterThan(lastAsked);
  });

  it("gives every recommendation evidence citing real MOQ/size/GSM fields", () => {
    const { recommendations } = matchProducts(sareeEnquiry, products);
    // Exclusive filtering: only the asked family (12 paper-bag SKUs) comes back.
    expect(recommendations.length).toBe(products.filter((p) => p.family === "paper-bag").length);
    for (const rec of recommendations) {
      expect(rec.evidence.length).toBeGreaterThanOrEqual(1);
      expect(rec.evidence.some((e) => /MOQ|GSM|×/.test(e.label))).toBe(true);
      expect(rec.product.sourceUrl).toMatch(/^https:\/\/roopac\.com\//);
    }
    // Spot-check: the cited facts match the product's actual spec fields.
    const vogue = recommendations.find((r) => r.product.slug === "vogue-on-redbull")!;
    expect(vogue.product.moq).toBe(300);
    expect(vogue.product.gsm).toBe(230);
    expect(vogue.evidence.some((e) => e.label.includes("MOQ 300"))).toBe(true);
    expect(vogue.evidence.some((e) => e.label.includes("230 GSM"))).toBe(true);
  });

  it("flags colour overruns against the product's real print capability", () => {
    const extract: EnquiryExtract = {
      ...emptyExtract,
      families: ["paper-bag"],
      quantity: 500,
      colours: 5,
    };
    const { recommendations } = matchProducts(extract, products);
    const vogue = recommendations.find((r) => r.product.slug === "vogue-on-redbull")!;
    expect(vogue.flags).toContain("you asked 5 colours — this prints up to 4 (Offset)");
  });

  it("returns noMatch with a tell-us-more reason when the extract has no signal", () => {
    const { recommendations, noMatch } = matchProducts({ ...emptyExtract }, products);
    expect(noMatch).not.toBeNull();
    expect(noMatch!.reason).toContain("no catalogue match");
    expect(noMatch!.nearestFamilies).toEqual([]);
    expect(recommendations).toEqual([]);
  });

  it("suggests nearest families from portfolio industry usage when only an industry is stated", () => {
    const extract: EnquiryExtract = { ...emptyExtract, industry: "Saree Boutique" };
    const { noMatch } = matchProducts(extract, products, portfolio);
    expect(noMatch).not.toBeNull();
    expect(noMatch!.nearestFamilies).toContain("paper-bag"); // 27 Saree Boutique jobs use it
  });
});

describe("similarJobs", () => {
  it("includes a Women's Tailoring job in the top 5 for the saree enquiry", () => {
    const jobs = similarJobs(sareeEnquiry, portfolio, 5, products);
    expect(jobs).toHaveLength(5);
    const hit = jobs.some(
      (j) => j.record.slug === "kee-and-you" || j.record.category === "Women's Tailoring",
    );
    expect(hit).toBe(true);
  });

  it("falls back to the default limit and still works without the products list", () => {
    const jobs = similarJobs(sareeEnquiry, portfolio);
    expect(jobs).toHaveLength(5);
  });

  it("explains itself: same city, same region, family overlap, related industry", () => {
    const jobs = similarJobs(sareeEnquiry, portfolio, portfolio.length, products);
    expect(jobs.some((j) => j.reasons.includes("same city: Coimbatore"))).toBe(true);
    expect(jobs.some((j) => j.reasons.includes("same region: Tamil Nadu"))).toBe(true);
    expect(jobs.some((j) => /^used \d+ of the same product families$/.test(j.reasons.join("; "))))
      .toBe(true);
    // Kee & You (Mysore, Women's Tailoring) matches on related industry + paper bags.
    const kee = jobs.find((j) => j.record.slug === "kee-and-you");
    expect(kee?.reasons).toContain("related industry: Women's Tailoring");
    expect(kee?.reasons).toContain("used 1 of the same product families");
  });

  it("gives an exact city match priority over the region fallback", () => {
    const extract: EnquiryExtract = { ...emptyExtract, city: "Chennai" };
    const jobs = similarJobs(extract, portfolio, portfolio.length);
    const chennaiJob = jobs.find((j) => j.record.city === "Chennai")!;
    expect(chennaiJob.reasons).toContain("same city: Chennai");
    expect(chennaiJob.reasons.some((r) => r.startsWith("same region"))).toBe(false);
  });
});

describe("matchProducts: family intent is exclusive", () => {
  // The public eval page once showed saree-box under a business-cards enquiry
  // because unrelated families filled the ranking when the asked family had
  // fewer than three SKUs.
  const cardEnquiry: EnquiryExtract = { ...emptyExtract, families: ["businesscard"], quantity: 100 };

  it("returns only asked-family products", () => {
    const { recommendations, noMatch } = matchProducts(cardEnquiry, products);
    expect(noMatch).toBeNull();
    expect(recommendations.length).toBeGreaterThan(0);
    for (const rec of recommendations) {
      expect(rec.product.family).toBe("businesscard");
    }
  });

  it("returns both business-card SKUs even though that is fewer than three", () => {
    const { recommendations } = matchProducts(cardEnquiry, products);
    expect(recommendations.map((r) => r.product.slug).sort()).toEqual([
      "business-card-everyday",
      "business-card-signature",
    ]);
  });
});
