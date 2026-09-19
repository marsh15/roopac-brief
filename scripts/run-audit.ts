/**
 * Catalogue Health auditor. Loads the committed snapshot (data/*.json), runs
 * the audit rules over it, and writes data/findings.json (FindingsFile shape).
 *
 * Deterministic: the findings themselves contain no timestamps and are sorted
 * by type then title — the same snapshot always produces identical findings.
 * Only the file-level `generatedAt` stamp changes between runs.
 * Run: npm run audit
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FindingsFile,
  PagesFile,
  ProductsFile,
  type Finding,
} from "../src/lib/data/schemas";
import {
  checkPrintMethodConflicts,
  checkTurnaroundConflicts,
} from "../src/lib/audit/rules";

const DATA = path.join(import.meta.dirname, "..", "data");

const productsFile = ProductsFile.parse(
  JSON.parse(await readFile(path.join(DATA, "products.json"), "utf8")),
);
const pagesFile = PagesFile.parse(
  JSON.parse(await readFile(path.join(DATA, "pages.json"), "utf8")),
);

const findings: Finding[] = [
  ...checkPrintMethodConflicts(productsFile.products),
  ...checkTurnaroundConflicts(productsFile.products, pagesFile.pages),
].sort((a, b) => (a.type === b.type ? a.title.localeCompare(b.title) : a.type.localeCompare(b.type)));

const out = FindingsFile.parse({
  generatedAt: new Date().toISOString(),
  findings,
});

await writeFile(path.join(DATA, "findings.json"), JSON.stringify(out, null, 2) + "\n", "utf8");

console.log(`Wrote data/findings.json — ${out.findings.length} finding(s):`);
for (const f of out.findings) {
  console.log(`  [${f.severity}] ${f.type}: ${f.title} (${f.sources.length} source(s))`);
}
