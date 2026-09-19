/**
 * Fails on any regression below the recorded baselines in evals/baseline.json.
 * `npm run eval:assert`
 * Record fresh baselines: npm run eval && npx tsx evals/record.ts
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");

interface Baseline {
  extractionAccuracy: number;
  missingDetectionRate: number;
  hallucinatedProducts: number;
  moqDetectionRate: number | null;
  similarJobRelevance: number | null;
}

const baseline: Baseline = JSON.parse(await readFile(path.join(ROOT, "evals", "baseline.json"), "utf8"));
const { metrics } = JSON.parse(await readFile(path.join(ROOT, "evals", "results.json"), "utf8"));

let failed = 0;
function check(name: string, current: number | null, floor: number | null) {
  if (floor === null || current === null) {
    console.log(`- ${name}: skipped (${current === null ? "no result" : "no baseline"})`);
    return;
  }
  const ok = current >= floor;
  console.log(`${ok ? "✓" : "✗"} ${name}: ${current} (baseline ≥ ${floor})`);
  if (!ok) failed++;
}
function checkMax(name: string, current: number, ceiling: number) {
  const ok = current <= ceiling;
  console.log(`${ok ? "✓" : "✗"} ${name}: ${current} (baseline ≤ ${ceiling})`);
  if (!ok) failed++;
}

check("extraction accuracy", metrics.extractionAccuracy, baseline.extractionAccuracy);
check("missing-field detection", metrics.missingDetectionRate, baseline.missingDetectionRate);
checkMax("hallucinated products", metrics.hallucinatedProducts, baseline.hallucinatedProducts);
check("MOQ-violation detection", metrics.moqDetectionRate, baseline.moqDetectionRate);
check("similar-job relevance", metrics.similarJobRelevance, baseline.similarJobRelevance);

console.log(failed === 0 ? "\nNo regressions." : `\n${failed} metric(s) below baseline`);
process.exit(failed === 0 ? 0 : 1);
