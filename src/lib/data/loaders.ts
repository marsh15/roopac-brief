import { readFile } from "node:fs/promises";
import path from "node:path";
import { ProductsFile, PortfolioFile, PagesFile, type Product, type PortfolioRecord, type SitePage } from "./schemas";

/**
 * Server-side loaders for the committed snapshot in data/. Read once, cached
 * for the process lifetime. No database — the snapshot is the source of truth.
 */

const DATA_DIR = path.join(process.cwd(), "data");

let productsCache: Product[] | null = null;
let portfolioCache: PortfolioRecord[] | null = null;
let pagesCache: SitePage[] | null = null;

export async function getProducts(): Promise<Product[]> {
  if (!productsCache) {
    const raw = JSON.parse(await readFile(path.join(DATA_DIR, "products.json"), "utf8"));
    productsCache = ProductsFile.parse(raw).products;
  }
  return productsCache;
}

export async function getPortfolio(): Promise<PortfolioRecord[]> {
  if (!portfolioCache) {
    const raw = JSON.parse(await readFile(path.join(DATA_DIR, "portfolio.json"), "utf8"));
    portfolioCache = PortfolioFile.parse(raw).records;
  }
  return portfolioCache;
}

export async function getPages(): Promise<SitePage[]> {
  if (!pagesCache) {
    const raw = JSON.parse(await readFile(path.join(DATA_DIR, "pages.json"), "utf8"));
    pagesCache = PagesFile.parse(raw).pages;
  }
  return pagesCache;
}

/** Distinct product-family slugs in the snapshot (the extraction/matching enum). */
export async function getFamilySlugs(): Promise<string[]> {
  const products = await getProducts();
  return [...new Set(products.map((p) => p.family))].sort();
}
