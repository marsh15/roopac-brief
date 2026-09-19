import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

export const metadata = { title: "Evals — Roopac Brief" };

interface Metrics {
  runAt: string;
  cases: number;
  extractionAccuracy: number;
  extractionFieldsChecked: number;
  missingDetectionRate: number;
  hallucinatedProducts: number;
  moqDetectionRate: number | null;
  similarJobRelevance: number | null;
  failedCases: number;
}
interface ResultsFile {
  metrics: Metrics;
  results: {
    id: string;
    ok: boolean;
    assertions: { name: string; pass: boolean; detail?: string }[];
    topSlugs?: string[];
  }[];
}

async function loadResults(): Promise<ResultsFile | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "evals", "results.json"), "utf8"));
  } catch {
    return null;
  }
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export default async function EvalsPage() {
  const data = await loadResults();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Eval suite</h1>
        <Link href="/" className="text-sm text-[var(--ink-3)] underline underline-offset-4 hover:text-[var(--ink)]">
          ← Brief builder
        </Link>
      </div>

      {!data ? (
        <div className="mt-8 rounded-xl border bg-card p-6 text-[15px] leading-relaxed text-[var(--ink-3)]">
          <p>
            No eval run found. Evals execute the 27-case suite against the live pipeline:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--ink)] p-4 font-mono text-[13px] text-[var(--paper)]">npm run eval</pre>
          <p className="mt-3">
            Requires <code className="font-mono">OPENAI_API_KEY</code> (24+ cases × one small-model call each).
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--ink-3)]">
            Run {new Date(data.metrics.runAt).toLocaleString()} · {data.metrics.cases} cases · programmatic assertions
            only (no LLM-as-judge)
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Extraction accuracy", `${pct(data.metrics.extractionAccuracy)} of ${data.metrics.extractionFieldsChecked} fields`],
              ["Missing-field detection", pct(data.metrics.missingDetectionRate)],
              ["Hallucinated products", String(data.metrics.hallucinatedProducts)],
              ["MOQ-violation detection", data.metrics.moqDetectionRate === null ? "n/a" : pct(data.metrics.moqDetectionRate)],
              ["Similar-job relevance", data.metrics.similarJobRelevance === null ? "n/a" : pct(data.metrics.similarJobRelevance)],
              ["Cases with failures", String(data.metrics.failedCases)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-card p-4">
                <div className="font-mono text-xl font-semibold">{value}</div>
                <div className="mt-1 text-xs text-[var(--ink-3)]">{label}</div>
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-sm font-bold uppercase tracking-[0.16em] text-[var(--ink-3)]">Per-case results</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-[var(--ink-3)]">
                  <th className="px-4 py-3 font-semibold">Case</th>
                  <th className="px-4 py-3 font-semibold">Assertions</th>
                  <th className="px-4 py-3 font-semibold">Top picks</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r) => {
                  const passed = r.assertions.filter((a) => a.pass).length;
                  const total = r.assertions.length;
                  const failures = r.assertions.filter((a) => !a.pass);
                  return (
                    <tr key={r.id} className="border-b last:border-0 align-top">
                      <td className="px-4 py-3 font-mono text-[13px]">{r.id}</td>
                      <td className="px-4 py-3">
                        <span className={passed === total ? "text-[var(--sage)]" : "text-[var(--accent)]"}>
                          {passed}/{total} pass
                        </span>
                        {failures.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-[var(--ink-3)]">
                            {failures.map((f) => (
                              <li key={f.name}>
                                ✗ {f.name}
                                {f.detail ? ` — ${f.detail}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--ink-3)]">
                        {(r.topSlugs ?? []).join(", ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
