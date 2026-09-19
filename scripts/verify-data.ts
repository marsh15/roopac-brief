/**
 * Assert the committed snapshot is complete and trustworthy.
 * Exits non-zero on any failure. Run: npm run verify-data
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ProductsFile, PortfolioFile, PagesFile } from "../src/lib/data/schemas";

const DATA = path.join(import.meta.dirname, "..", "data");

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const productsRaw = JSON.parse(await readFile(path.join(DATA, "products.json"), "utf8"));
const portfolioRaw = JSON.parse(await readFile(path.join(DATA, "portfolio.json"), "utf8"));
const pagesRaw = JSON.parse(await readFile(path.join(DATA, "pages.json"), "utf8"));

const products = ProductsFile.parse(productsRaw).products;
const records = PortfolioFile.parse(portfolioRaw).records;
const pages = PagesFile.parse(pagesRaw).pages;

check("64 products", products.length === 64, `got ${products.length}`);
check("≥400 portfolio records", records.length >= 400, `got ${records.length}`);
check(
  "every product has MOQ + print method + source URL",
  products.every((p) => p.moq !== null && p.printMethod !== null && p.sourceUrl.startsWith("https://roopac.com/products/")),
  products.filter((p) => !p.moq || !p.printMethod).map((p) => p.slug).join(", ") || "all pass",
);
check(
  "every portfolio record has category; productsUsed on ≥99%",
  records.every((r) => r.category) && records.filter((r) => r.productsUsed.length > 0).length >= Math.floor(records.length * 0.99),
  records.filter((r) => !r.productsUsed.length).map((r) => r.slug).join(", ") || "all pass",
);

// spot checks against docs/roopac-research.md §2
const classic = products.find((p) => p.slug === "classic-on-butterfly")!;
const vogue = products.find((p) => p.slug === "vogue-on-redbull")!;
check("classic-on-butterfly: MOQ 300, Offset, 150 GSM", classic.moq === 300 && classic.printMethod === "Offset" && classic.gsm === 150);
check("vogue-on-redbull: 230 GSM FBB", vogue.gsm === 230 && /FBB/i.test(vogue.material ?? ""));

// spot checks against §3
const kee = records.find((r) => r.slug === "kee-and-you");
const maya = records.find((r) => r.slug === "maya-mantra");
check("kee-and-you: Women's Tailoring, Mysore", kee?.category === "Women's Tailoring" && kee?.city === "Mysore");
check("maya-mantra: 7 products used", maya?.productsUsed.length === 7, `got ${maya?.productsUsed.length}`);

// city sparseness is expected (§7): ~343/424
const withCity = records.filter((r) => r.city).length;
check("city coverage in expected band (250–424)", withCity >= 250 && withCity <= records.length, `${withCity}/${records.length}`);

check("pages: 3 static + 64 product pages", pages.filter((p) => p.kind === "static").length === 3 && pages.filter((p) => p.kind === "product").length === 64, `got ${pages.length}`);

console.log(failures === 0 ? "\nAll snapshot checks passed." : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
