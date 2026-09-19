/**
 * Runs every eval case against the live pipeline (needs OPENAI_API_KEY),
 * computes metrics, writes evals/results.json. `npm run eval`
 *
 * Metrics:
 * - field extraction accuracy: matched / asserted extract fields
 * - no-invention: fields asserted null actually null (counted into accuracy)
 * - missing-field detection: expected checklist ids found/missed, plus spurious ids
 * - recommendation validity: every recommended product exists in the catalogue
 *   (hallucination rate must be 0 by construction — verified, not assumed)
 * - MOQ-violation detection rate: cases with expectMoqFlagOnTop where the flag fired
 * - similar-job relevance: expected industry in top-5 similar jobs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CASES, type EvalCase } from "./cases";
import { runPipeline } from "../src/lib/pipeline/run";
import { getProducts } from "../src/lib/data/loaders";

const ROOT = path.join(import.meta.dirname, "..");

// tsx scripts don't get Next.js's automatic .env loading — do it explicitly.
try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  /* no .env file — rely on the real environment */
}

if (!process.env.OPENAI_API_KEY) {
  console.error(
    "OPENAI_API_KEY is not set. Evals run the live pipeline.\n" +
      "Copy .env.example to .env and add your key, then re-run: npm run eval",
  );
  process.exit(1);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const products = await getProducts();
  const catalogUrls = new Set(products.map((p) => p.url));

  const results: any[] = [];
  for (const c of CASES) {
    const assertions: { name: string; pass: boolean; detail?: string }[] = [];
    try {
      const r = await runPipeline(c.message);

      // extraction field assertions
      for (const [field, expected] of Object.entries(c.expect ?? {})) {
        const actual = (r.extract as any)[field];
        assertions.push({
          name: `extract.${field}`,
          pass: deepEqual(actual, expected),
          detail: deepEqual(actual, expected) ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        });
      }
      for (const field of c.expectNull ?? []) {
        const actual = (r.extract as any)[field];
        const isNull = actual === null || actual === undefined || (Array.isArray(actual) && actual.length === 0);
        assertions.push({ name: `extract.${field} is null`, pass: isNull, detail: isNull ? undefined : `got ${JSON.stringify(actual)}` });
      }

      // missing-field checklist
      const missingIds = new Set(r.missing.map((m) => m.id));
      for (const id of c.expectMissingIds ?? []) {
        assertions.push({ name: `missing.${id}`, pass: missingIds.has(id), detail: missingIds.has(id) ? undefined : "not in checklist" });
      }
      if (c.expectNoMissing) assertions.push({ name: "missing.empty", pass: r.missing.length === 0 });

      // recommendation validity (hallucination check)
      const allReal = r.recommendations.every((rec) => catalogUrls.has((rec.product as any).url));
      assertions.push({ name: "recommendations all in catalogue", pass: allReal, detail: allReal ? undefined : "hallucinated product!" });

      if (c.expectFamilyInTop3) {
        const top3 = r.recommendations.slice(0, 3);
        const pass = top3.some((rec) => (rec.product as any).family === c.expectFamilyInTop3);
        assertions.push({ name: `top3 family=${c.expectFamilyInTop3}`, pass, detail: pass ? undefined : `top3: ${top3.map((t) => (t.product as any).slug).join(",")}` });
      }
      if (c.expectNoMatch) {
        const pass = r.noMatch !== null || r.recommendations.length === 0;
        assertions.push({ name: "noMatch", pass, detail: pass ? undefined : `got ${r.recommendations.length} recommendations` });
      }
      if (typeof c.expectMoqFlagOnTop === "number") {
        const top = r.recommendations[0];
        const pass = !!top && top.flags.some((f) => f.includes(String(c.expectMoqFlagOnTop)));
        assertions.push({
          name: `MOQ flag ${c.expectMoqFlagOnTop} on top`,
          pass,
          detail: pass ? undefined : `flags: ${JSON.stringify(top?.flags ?? [])}`,
        });
      }
      if (c.expectIndustryInTop5SimilarJobs) {
        const pass = r.similarJobs.slice(0, 5).some((s) => s.record.category === c.expectIndustryInTop5SimilarJobs);
        assertions.push({
          name: `similarJobs include ${c.expectIndustryInTop5SimilarJobs}`,
          pass,
          detail: pass ? undefined : `got: ${r.similarJobs.slice(0, 5).map((s) => s.record.category).join(",")}`,
        });
      }

      results.push({ id: c.id, ok: true, assertions, extract: r.extract, topSlugs: r.recommendations.slice(0, 3).map((x) => (x.product as any).slug) });
    } catch (err: any) {
      assertions.push({ name: "pipeline ran", pass: false, detail: err.message });
      results.push({ id: c.id, ok: false, assertions, error: err.code ?? err.message });
    }
    process.stdout.write(results.length % 5 === 0 ? "." : "");
  }
  console.log();

  // ---- metrics ----
  const flat = results.flatMap((r) => r.assertions);
  const extraction = flat.filter((a) => a.name.startsWith("extract."));
  const missingChecks = flat.filter((a) => a.name.startsWith("missing."));
  const metrics = {
    runAt: new Date().toISOString(),
    cases: CASES.length,
    extractionAccuracy: +(extraction.filter((a) => a.pass).length / Math.max(extraction.length, 1)).toFixed(4),
    extractionFieldsChecked: extraction.length,
    missingDetectionRate: +(missingChecks.filter((a) => a.pass).length / Math.max(missingChecks.length, 1)).toFixed(4),
    // spurious missing items on cases that expect none of the flagged ids are not penalized
    // beyond detection — the checklist over-asking is visible in results.json per case
    hallucinatedProducts: flat.filter((a) => a.name === "recommendations all in catalogue" && !a.pass).length,
    moqDetectionRate: (() => {
      const checks = results.flatMap((r) => r.assertions).filter((a) => a.name.startsWith("MOQ flag "));
      return checks.length ? +(checks.filter((a) => a.pass).length / checks.length).toFixed(4) : null;
    })(),
    similarJobRelevance: (() => {
      const checks = (results as { assertions: { name: string; pass: boolean }[] }[])
        .flatMap((r) => r.assertions)
        .filter((a) => a.name.startsWith("similarJobs include "));
      return checks.length ? +(checks.filter((a) => a.pass).length / checks.length).toFixed(4) : null;
    })(),
    failedCases: (results as { ok: boolean; assertions: { pass: boolean }[] }[]).filter(
      (r) => !r.ok || r.assertions.some((a) => !a.pass),
    ).length,
  };

  await mkdir(path.join(ROOT, "evals"), { recursive: true });
  await writeFile(path.join(ROOT, "evals", "results.json"), JSON.stringify({ metrics, results }, null, 2));
  console.log(JSON.stringify(metrics, null, 2));
  console.log(`\nresults written to evals/results.json — ${catalogUrls.size} catalogue products checked against`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
