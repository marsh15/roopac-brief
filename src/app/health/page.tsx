import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { FindingsFile, PagesFile, type Finding } from "@/lib/data/schemas";

export const metadata: Metadata = {
  title: "Catalogue Health — Roopac Brief",
  description:
    "Contradictions found in a public snapshot of roopac.com: print-method conflicts and turnaround promises that cannot all hold.",
};

const DATA_DIR = path.join(process.cwd(), "data");

async function readDataFile(name: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(DATA_DIR, name), "utf8"));
}

const TYPE_LABELS: Record<string, string> = {
  "print-method": "Print-method contradictions",
  turnaround: "Turnaround / SLA conflicts",
};

function severityStyle(severity: Finding["severity"]): string {
  switch (severity) {
    case "high":
      return "border-[var(--destructive)]/40 text-[var(--destructive)]";
    case "medium":
      return "border-[var(--accent)]/40 text-[var(--accent)]";
    default:
      return "border-[var(--sage)]/40 text-[var(--sage)]";
  }
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="border-t border-[var(--line)] pt-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-[15px] font-semibold tracking-tight">{finding.title}</h3>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${severityStyle(finding.severity)}`}
        >
          {finding.severity}
        </span>
      </div>

      <ul className="mt-4 space-y-4">
        {finding.sources.map((source, i) => (
          <li key={`${source.url}-${i}`}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-[var(--accent)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]"
            >
              {source.url}
            </a>
            <blockquote className="mt-1 border-l-2 border-[var(--line)] pl-3 text-sm leading-relaxed text-[var(--ink)]">
              “{source.quote}”
            </blockquote>
          </li>
        ))}
      </ul>

      <p className="mt-4 max-w-prose text-sm leading-relaxed text-[var(--ink-3)]">{finding.explanation}</p>
    </article>
  );
}

export default async function HealthPage() {
  const [snapshot, findingsRaw] = await Promise.all([
    readDataFile("pages.json").then((d) => PagesFile.parse(d)),
    readDataFile("findings.json")
      .then((d) => FindingsFile.parse(d))
      .catch(() => null),
  ]);

  const findings = findingsRaw?.findings ?? [];
  const types = [...new Set(findings.map((f) => f.type))];

  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="font-mono text-xs tracking-widest text-[var(--ink-3)] uppercase">Roopac Brief</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Catalogue Health</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-3)]">
        Generated from a public snapshot of roopac.com dated {snapshot.snapshotDate}. Every claim below quotes the
        snapshot verbatim and links to the live page it was captured from.
      </p>

      {findings.length === 0 ? (
        <p className="mt-10 border-t border-[var(--line)] pt-6 text-sm text-[var(--ink-3)]">
          No findings file found. Run <code className="font-mono text-sm">npm run audit</code> to generate
          data/findings.json.
        </p>
      ) : (
        <div className="mt-10 space-y-12">
          {types.map((type) => (
            <section key={type} aria-label={TYPE_LABELS[type] ?? type}>
              <h2 className="font-mono text-xs tracking-widest text-[var(--ink-3)] uppercase">
                {TYPE_LABELS[type] ?? type}
                <span className="ml-2 text-[var(--line)]">
                  {findings.filter((f) => f.type === type).length}
                </span>
              </h2>
              <div className="mt-6 space-y-8">
                {findings
                  .filter((f) => f.type === type)
                  .map((f) => (
                    <FindingCard key={f.title} finding={f} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
