/**
 * Snapshot roopac.com into committed JSON: data/products.json,
 * data/portfolio.json, data/pages.json.
 *
 * Polite crawl: sequential fetches, ~300ms delay, raw HTML cached under
 * .cache/ (gitignored) so re-runs don't re-fetch. No pricing (client-side
 * configurator — impossible from static HTML). Missing fields stay null.
 *
 * Run: npm run snapshot
 */
import * as cheerio from "cheerio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, ".cache");
const DATA = path.join(ROOT, "data");
const BASE = "https://roopac.com";
const DELAY_MS = 300;
const SNAPSHOT_DATE = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- fetch

async function fetchCached(urlPath: string): Promise<string> {
  const name = urlPath === "/" ? "home" : urlPath.replaceAll("/", "_");
  const file = path.join(CACHE, `${name}.html`);
  if (existsSync(file)) return readFile(file, "utf8");
  const res = await fetch(`${BASE}${urlPath}`, {
    headers: { "user-agent": "roopac-brief-snapshot/0.1 (job-application prototype)" },
  });
  if (!res.ok) throw new Error(`fetch ${urlPath}: ${res.status}`);
  const html = await res.text();
  await writeFile(file, html);
  await new Promise((r) => setTimeout(r, DELAY_MS));
  return html;
}

// ---------------------------------------------------------------- sitemap

async function getUrls(): Promise<{ products: string[]; statics: string[]; families: string[] }> {
  const xml = await fetchCached("/sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(BASE, ""),
  );
  const products = locs.filter((u) => u.startsWith("/products/"));
  const families = locs.filter((u) => u.startsWith("/families/"));
  const statics = ["/", "/shipping", "/faq"];
  return { products, statics, families };
}

/** SKU → family slug, from each /families/<slug> page's own product links. */
async function getFamilyMap(familyPaths: string[]): Promise<Map<string, { family: string; label: string }>> {
  const map = new Map<string, { family: string; label: string }>();
  for (const fp of familyPaths) {
    const html = await fetchCached(fp);
    const family = fp.replace("/families/", "");
    const label =
      cheerio
        .load(html)("h1")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\.$/, "") || family;
    for (const href of [...html.matchAll(/href="\/products\/([a-z0-9-]+)"/g)].map((m) => m[1])) {
      if (!map.has(href)) map.set(href, { family, label });
    }
    console.log(`  family ${family}: cumulative ${map.size} SKUs mapped`);
  }
  return map;
}

// ---------------------------------------------------------------- product parsing

function textOf($: cheerio.CheerioAPI, el: any): string {
  return $(el).text().replace(/\s+/g, " ").trim();
}

function parseGsm(thickness: string | null): number | null {
  if (!thickness) return null;
  const m = thickness.match(/(\d+(?:\.\d+)?)\s*(?:GSM|gsm)/);
  return m ? Number(m[1]) : null;
}

function parseProduct(html: string, urlPath: string): any {
  const $ = cheerio.load(html);
  const slug = urlPath.replace("/products/", "");

  const h1 = $("h1").first().clone();
  h1.find("span.accent-serif").remove();
  const name = textOf($, h1).replace(/\.$/, "");

  // family from BreadcrumbList JSON-LD (position 2, e.g. /category/paper-bags);
  // nav /category/ links are excluded on purpose — they are shop categories, not the product family
  let family = "unknown";
  let familyLabel = "";
  const eyebrowText = $("div.eyebrow")
    .map((_, el) => textOf($, el))
    .get()
    .find((t: string) => /^[A-Z][A-Z &/'-]+ · MOQ \d+$/.test(t));
  const moqFromEyebrow = eyebrowText?.match(/MOQ (\d+)/)?.[1];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text());
      for (const obj of Array.isArray(json) ? json : [json]) {
        if (obj["@type"] === "BreadcrumbList" && Array.isArray(obj.itemListElement)) {
          const parent = obj.itemListElement.find((li: any) => li.position === 2 && String(li.item ?? "").includes("/category/"));
          if (parent) {
            family = String(parent.item).replace(/.*\/category\//, "");
            familyLabel = parent.name ?? "";
          }
        }
      }
    } catch {
      /* tolerate malformed JSON-LD */
    }
  });

  // tagline: italic serif line under the h1; description: first 520px paragraph
  const tagline = $("p.mb-4").first().text().replace(/\s+/g, " ").trim() || null;
  const description = $("p.max-\\[520px\\]").first().text().replace(/\s+/g, " ").trim() || "";

  // spec pairs: desktop eyebrow/value grid, mobile rp-spec cells — merge
  const specs = new Map<string, string>();
  $("div.hidden.md\\:grid > div").each((_, cell) => {
    const label = $(cell).find("div.eyebrow").first().text().replace(/\s+/g, " ").trim();
    const value = $(cell).children("div").not(".eyebrow").first().text().replace(/\s+/g, " ").trim();
    if (label && value) specs.set(label.toLowerCase(), value);
  });
  $(".rp-spec__cell").each((_, cell) => {
    const label = textOf($, $(cell).find(".rp-spec__label"));
    const value = textOf($, $(cell).find(".rp-spec__value"));
    if (label && value && !specs.has(label.toLowerCase())) specs.set(label.toLowerCase(), value);
  });
  const get = (...keys: string[]): string | null => {
    for (const k of keys) if (specs.get(k)) return specs.get(k)!;
    return null;
  };

  const material = get("material");
  const thickness = get("thickness");
  const printMethod = get("print method", "printmethod");
  const leadTime = get("lead time", "leadtime");

  // MOQ: eyebrow "PAPER BAGS · MOQ 300" → "Min. 300 pcs" fallback
  const moqRaw =
    moqFromEyebrow ??
    html.match(/Min\.\s*<!--\s*-->([\d,]+)|Min\.\s*([\d,]+)\s*pcs/)?.[1] ??
    html.match(/Min\.\s*([\d,]+)\s*pcs/)?.[1];
  const moq = moqRaw ? Number(moqRaw.replace(/,/g, "")) : null;

  // configurator region slices: Size … Print … Quantity … Order turnaround
  const sizeStart = html.search(/text-neutral-500">Size</);
  const printStart = html.slice(sizeStart + 1).search(/text-neutral-500">Print/) + sizeStart + 1;
  const qtyStart = html.slice(printStart + 1).search(/text-neutral-500">Quantity</) + printStart + 1;
  const sizeSeg = sizeStart >= 0 && printStart > sizeStart ? html.slice(sizeStart, printStart) : "";
  const printSeg = printStart > 0 && qtyStart > printStart ? html.slice(printStart, qtyStart) : "";

  const sizeRe = /(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*[×x]\s*\d+(?:\.\d+)?(?:\s*[×x]\s*\d+(?:\.\d+)?)?\s*(?:in|inches|mm|"))/gi;
  const sizes = sizeSeg
    ? [...new Set([...sizeSeg.matchAll(sizeRe)].map((m) => m[1].replace(/\s+/g, " ").trim()))]
    : [];

  const printOptions = printSeg
    ? ["Single Colour", "1 Colour", "Two Colour", "2 Colour", "Full Colour (CMYK)"].filter(
        (o) => printSeg.includes(o.replace(" (CMYK)", "")) || printSeg.includes(o),
      )
    : [];
  const maxColors = printSeg.includes("Full Colour")
    ? 4
    : printSeg.includes("Two Colour") || printSeg.includes("2 Colour")
      ? 2
      : printSeg.includes("Single Colour") || printSeg.includes("1 Colour")
        ? 1
        : null;

  // turnaround selector
  const tValue = $('[data-turnaround="value"]').find("span").last().text().replace(/\s+/g, " ").trim() || null;
  const tPriority = $('[data-turnaround="priority"]').find("span").last().text().replace(/\s+/g, " ").trim() || null;
  const tNote = html.match(/(Shipping time is separate[^<]*)/)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  const turnaround = tValue || tPriority ? { value: tValue, priority: tPriority, note: tNote } : null;

  // benefits badges
  const benefits: string[] = [];
  $("div[data-pdp-benefits] span").each((_, el) => {
    const t = textOf($, el);
    if (t && !benefits.includes(t)) benefits.push(t);
  });

  // process steps under "HOW IT GOES"
  const processSteps: { num: string; title: string; text: string }[] = [];
  const howItGoes = $("div.eyebrow").filter((_, el) => textOf($, el) === "HOW IT GOES").first();
  if (howItGoes.length) {
    const ancestors = howItGoes.parents().toArray();
    const container = ancestors.find((a) => $(a).find("div[class*='py-7']").length > 0);
    if (container)
      $(container)
        .find("div[class*='py-7']")
        .each((_, cell) => {
      const num = textOf($, $(cell).find("span.font-mono").first());
      const divs = $(cell).children("div");
      const title = textOf($, divs.eq(1));
      const body = divs.slice(2).map((_, d) => textOf($, d)).get().join(" ").trim();
      if (/^\d{2}$/.test(num) && title) processSteps.push({ num, title, text: body });
    });
  }

  // FAQ JSON-LD
  const faq: { q: string; a: string }[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text());
      const pages = Array.isArray(json) ? json : [json];
      for (const obj of pages) {
        if (obj["@type"] === "FAQPage" && Array.isArray(obj.mainEntity)) {
          for (const q of obj.mainEntity) {
            if (q["@type"] === "Question" && q.acceptedAnswer?.["@type"] === "Answer")
              faq.push({ q: q.name, a: q.acceptedAnswer.text });
          }
        }
      }
    } catch {
      /* tolerate malformed JSON-LD */
    }
  });

  return {
    slug,
    name,
    url: `${BASE}${urlPath}`,
    family,
    familyLabel,
    tagline,
    description,
    material,
    thickness,
    gsm: parseGsm(thickness),
    sizes,
    printMethod,
    printOptions,
    maxColors,
    moq,
    leadTime,
    turnaround,
    benefits,
    processSteps,
    faq,
    sourceUrl: `${BASE}${urlPath}`,
  };
}

// ---------------------------------------------------------------- portfolio (RSC payload)

/** Unescape and concatenate all RSC flight chunks from a page. */
function flightPayload(html: string): string {
  const chunks: string[] = [];
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  for (const m of html.matchAll(re)) {
    try {
      chunks.push(JSON.parse(m[1]) as string);
    } catch {
      /* skip malformed chunk */
    }
  }
  return chunks.join("");
}

/** Extract the JSON object starting at `{"` from pos, respecting strings/escapes. */
function balancedObject(s: string, start: number): string | null {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function parsePortfolio(html: string): any[] {
  const payload = flightPayload(html);
  // RSC serializes undefined as the string "$undefined"
  const clean = (v: unknown) => (v === undefined || v === "$undefined" ? null : v);
  const records: any[] = [];
  const seen = new Set<string>();
  let idx = payload.indexOf('{"slug"');
  while (idx !== -1) {
    const raw = balancedObject(payload, idx);
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        if (obj.slug && obj.brandName && obj.category && !seen.has(obj.slug)) {
          seen.add(obj.slug);
          const yearClean = clean(obj.year);
          records.push({
            slug: obj.slug,
            brandName: obj.brandName,
            category: obj.category,
            city: clean(obj.city),
            year: yearClean !== null && !isNaN(Number(yearClean)) ? Number(yearClean) : null,
            shortDescription: clean(obj.shortDescription),
            description: clean(obj.description),
            caseNumber: clean(obj.caseNumber) === null ? null : String(obj.caseNumber),
            productsUsed: Array.isArray(obj.productsUsed)
              ? obj.productsUsed.map((p: any) => ({ href: p.href ?? "", name: p.name ?? "", type: clean(p.type) }))
              : [],
            clientQuote: clean(obj.clientQuote),
            clientQuoteBy: clean(obj.clientQuoteBy),
            outcomeStat: clean(obj.outcomeStat),
            outcomeLabel: clean(obj.outcomeLabel),
            url: `${BASE}/portfolio/${obj.slug}`,
          });
        }
      } catch {
        /* tolerate unparsable fragments */
      }
    }
    idx = payload.indexOf('{"slug"', idx + 1);
  }
  return records;
}

// ---------------------------------------------------------------- pages text

const BLOCK = "p,h1,h2,h3,h4,h5,h6,li,td,th,button,span,div";

function extractSegments(html: string): string[] {
  const $ = cheerio.load(html);
  $("script, style, svg, noscript, template").remove();
  const segments: string[] = [];
  $(BLOCK).each((_, el) => {
    // only leaf-ish blocks: no block-level element children
    if ($(el).find("p, div, ul, ol, table, section, h1, h2, h3, h4, h5, h6, li, button").length) return;
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length >= 3 && segments[segments.length - 1] !== t) segments.push(t);
  });
  return segments;
}

// ---------------------------------------------------------------- main

async function main() {
  await mkdir(CACHE, { recursive: true });
  await mkdir(DATA, { recursive: true });

  const { products: productPaths, families: familyPaths } = await getUrls();
  console.log(`sitemap: ${productPaths.length} product pages`);
  const familyMap = await getFamilyMap(familyPaths);

  const products: any[] = [];
  const productPages: any[] = [];
  for (const p of productPaths) {
    const html = await fetchCached(p);
    const product = parseProduct(html, p);
    const fm = familyMap.get(product.slug);
    if (fm) {
      product.family = fm.family;
      if (!product.familyLabel) product.familyLabel = fm.label;
    } else {
      // SKUs Roopac lists on no family page (verified 2026-09-19): keep their
      // breadcrumb category, except the stationery items grouped with stationery
      // in docs/roopac-research.md §2.
      const stationeryFallback = new Set(["thanks-card", "tissue-paper"]);
      if (stationeryFallback.has(product.slug) && product.family === "ecom") product.family = "stationery";
    }
    products.push(product);
    productPages.push({
      url: `${BASE}${p}`,
      kind: "product" as const,
      title: product.name,
      segments: extractSegments(html),
      productSlug: product.slug,
      snapshotDate: SNAPSHOT_DATE,
    });
    console.log(`  ${product.slug}: moq=${product.moq} print=${product.printMethod} gsm=${product.gsm} sizes=${product.sizes.length} steps=${product.processSteps.length}`);
  }

  for (const s of ["/", "/shipping", "/faq"]) {
    const html = await fetchCached(s);
    productPages.push({
      url: `${BASE}${s}`,
      kind: "static" as const,
      title: s === "/" ? "Home" : s.slice(1),
      segments: extractSegments(html),
      productSlug: null,
      snapshotDate: SNAPSHOT_DATE,
    });
    console.log(`  static ${s}: ${extractSegments(html).length} segments`);
  }

  const portfolioHtml = await fetchCached("/portfolio");
  const records = parsePortfolio(portfolioHtml);
  console.log(`portfolio: ${records.length} records`);

  await writeFile(
    path.join(DATA, "products.json"),
    JSON.stringify({ snapshotDate: SNAPSHOT_DATE, source: BASE, products }, null, 2),
  );
  await writeFile(
    path.join(DATA, "portfolio.json"),
    JSON.stringify({ snapshotDate: SNAPSHOT_DATE, source: BASE, records }, null, 2),
  );
  // static pages first, then product pages
  await writeFile(
    path.join(DATA, "pages.json"),
    JSON.stringify(
      {
        snapshotDate: SNAPSHOT_DATE,
        source: BASE,
        pages: [...productPages.filter((p) => p.kind === "static"), ...productPages.filter((p) => p.kind === "product")],
      },
      null,
      2,
    ),
  );
  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
