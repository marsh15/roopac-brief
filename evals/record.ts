/** Records evals/results.json metrics as the new baseline. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const { metrics, results } = JSON.parse(await readFile(path.join(ROOT, "evals", "results.json"), "utf8"));

// Never record a baseline off a broken run — a garbage baseline makes
// eval:assert pass trivially forever. Cases with failing ASSERTIONS are fine
// (that's what baselines encode: known failure modes); crashed cases are not.
const crashed = results.filter((r: any) => r.ok === false).length;
if (crashed > 0 || metrics.extractionFieldsChecked === 0) {
  console.error(
    `Refusing to record: ${crashed} case(s) crashed (pipeline errors, not assertion failures) ` +
      `and ${metrics.extractionFieldsChecked} extraction fields were checked. Fix the run first (npm run eval).`,
  );
  process.exit(1);
}

const baseline = {
  extractionAccuracy: metrics.extractionAccuracy,
  missingDetectionRate: metrics.missingDetectionRate,
  hallucinatedProducts: metrics.hallucinatedProducts,
  moqDetectionRate: metrics.moqDetectionRate,
  similarJobRelevance: metrics.similarJobRelevance,
};
await writeFile(path.join(ROOT, "evals", "baseline.json"), JSON.stringify(baseline, null, 2) + "\n");
console.log("baseline recorded:", baseline);
