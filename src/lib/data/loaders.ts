import { readFile } from "node:fs/promises";
import path from "node:path";
import { ProductsFile, PortfolioFile, PagesFile } from "./schemas";

/**
 * Server-side loaders for the committed snapshot in data/. Read once, cached
 * for the process lifetime. No database — the snapshot is the source of truth.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const cache = new Map<string, unknown>();

async function cachedParse<T>(file: string, pick: (raw: unknown) => T): Promise<T> {
  if (!cache.has(file)) {
    cache.set(file, pick(JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8"))));
  }
  return cache.get(file) as T;
}

export const getProducts = () => cachedParse("products.json", (raw) => ProductsFile.parse(raw).products);

export const getPortfolio = () => cachedParse("portfolio.json", (raw) => PortfolioFile.parse(raw).records);

export const getPages = () => cachedParse("pages.json", (raw) => PagesFile.parse(raw).pages);

/** Distinct product-family slugs in the snapshot (the extraction/matching enum). */
export async function getFamilySlugs(): Promise<string[]> {
  const products = await getProducts();
  return [...new Set(products.map((p) => p.family))].sort();
}
