/** Records evals/results.json metrics as the new baseline. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const { metrics } = JSON.parse(await readFile(path.join(ROOT, "evals", "results.json"), "utf8"));
const baseline = {
  extractionAccuracy: metrics.extractionAccuracy,
  missingDetectionRate: metrics.missingDetectionRate,
  hallucinatedProducts: metrics.hallucinatedProducts,
  moqDetectionRate: metrics.moqDetectionRate,
  similarJobRelevance: metrics.similarJobRelevance,
};
await writeFile(path.join(ROOT, "evals", "baseline.json"), JSON.stringify(baseline, null, 2) + "\n");
console.log("baseline recorded:", baseline);
