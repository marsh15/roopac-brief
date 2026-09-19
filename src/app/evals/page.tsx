import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

export const metadata = { title: "Evals · Roopac Brief" };

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
    <main id="main" className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-3">Roopac Brief</p>
        <Link
          href="/"
          className="text-sm text-ink-3 underline underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
        >
          <span aria-hidden>← </span>Brief builder
        </Link>
      </div>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Eval suite</h1>

      {!data ? (
        <div className="mt-8 rounded-xl border border-line bg-card p-6 text-[15px] leading-relaxed text-ink-2">
          <p>
            No eval run found. Evals execute the full case suite against the live pipeline:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-4 font-mono text-[13px] text-paper">npm run eval</pre>
          <p className="mt-3">
            Requires <code className="font-mono">OPENAI_API_KEY</code> (one small-model call per case).
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-2 tabular-nums">
            Run {new Date(data.metrics.runAt).toLocaleString()} · {data.metrics.cases} cases, programmatic
            assertions only (no LLM-as-judge)
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
              <div key={label} className="rounded-xl border border-line bg-card p-4">
                <div className="font-mono text-xl font-semibold tabular-nums">{value}</div>
                <div className="mt-1 text-xs text-ink-3">{label}</div>
              </div>
            ))}
          </div>

          <h2 className="mt-10 flex items-baseline gap-2.5 font-serif text-[19px] font-semibold tracking-tight">
            Per-case results
            <span className="font-mono text-[11px] font-normal tabular-nums text-ink-3">
              {data.results.length}
            </span>
          </h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
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
                    <tr key={r.id} className="border-b border-line last:border-0 align-top">
                      <td className="px-4 py-3 font-mono text-[13px]">{r.id}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`tabular-nums ${passed === total ? "text-sage" : "text-accent"}`}
                        >
                          {passed}/{total} pass
                        </span>
                        {failures.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-ink-3">
                            {failures.map((f) => (
                              <li key={f.name}>
                                ✗ {f.name}
                                {f.detail ? `: ${f.detail}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-3">
                        {(r.topSlugs ?? []).join(", ") || "none"}
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
