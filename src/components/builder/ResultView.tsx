import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import CopyButton from "./CopyButton";
import VerdictBadge from "./VerdictBadge";
import type { ArtworkTriage, PipelineResult, Recommendation, ReplyState } from "./types";

/**
 * The built brief, sectioned. Every value on screen comes from the API
 * response — nothing is inferred or hard-coded here.
 */
export default function ResultView({
  result,
  triage,
  onArtworkClear,
  reply,
}: {
  result: PipelineResult;
  triage: ArtworkTriage | null;
  onArtworkClear: () => void;
  reply: ReplyState;
}) {
  return (
    <div className="space-y-11">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
          Job {result.jobNumber}
        </span>
        <span className="flex-1 border-t border-dashed border-line" />
      </div>

      <Section id="understood" index="01" title="Understood">
        <Understood result={result} />
      </Section>

      <Section id="recommendations" index="02" title="Recommended products">
        <Recommendations result={result} />
      </Section>

      <Section id="similar" index="03" title="Similar Roopac work">
        <SimilarJobs result={result} />
      </Section>

      <Section id="missing" index="04" title="Still required">
        <StillRequired result={result} />
      </Section>

      {triage && (
        <Section id="artwork" index="05" title="Artwork readiness">
          <ArtworkReadiness triage={triage} onClear={onArtworkClear} />
        </Section>
      )}

      <Section id="brief" index="06" title="Job brief">
        <div className="overflow-hidden rounded-xl border border-line bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              {result.jobNumber} · plain text
            </span>
            <CopyButton text={result.brief} label="Copy brief" toastText="Brief copied" />
          </div>
          <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-[12.5px] leading-[1.7]">
            {result.brief}
          </pre>
        </div>
      </Section>

      <Section id="reply" index="07" title="WhatsApp reply">
        <ReplyPanel reply={reply} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- section shell

function Section({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <div className="flex items-baseline gap-3">
        <span aria-hidden className="font-mono text-[11px] text-ink-3">
          {index}
        </span>
        <h2 className="font-serif text-[21px] font-semibold leading-snug tracking-tight text-ink">
          {title}
        </h2>
        <span aria-hidden className="mt-3 flex-1 self-start border-t border-line" />
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- 01 understood

function Understood({ result }: { result: PipelineResult }) {
  const e = result.extract;
  const ambiguousDeadline = e.deadlineText !== null && e.deadline === null;

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Industry", value: e.industry ?? e.industryRaw },
    { label: "City", value: e.city },
    { label: "Quantity", value: e.quantity === null ? null : e.quantity.toLocaleString("en-IN") },
    { label: "Sizes", value: e.sizes.length ? e.sizes.join(", ") : null },
    { label: "Colours", value: e.colours === null ? null : String(e.colours) },
    { label: "Positioning", value: e.positioning },
    { label: "Deadline", value: e.deadline ?? (e.deadlineText ? `“${e.deadlineText}”` : null) },
    { label: "Language", value: e.language },
  ];
  if (e.usage) rows.push({ label: "Use case", value: e.usage });
  if (e.familiesRaw.length) rows.push({ label: "Asked for", value: e.familiesRaw.join(", ") });

  return (
    <div>
      <dl className="overflow-hidden rounded-xl border border-line bg-card">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[6.5rem_1fr] items-baseline gap-x-4 border-b border-line/60 px-4 py-2.5 last:border-b-0 sm:grid-cols-[8rem_1fr]"
          >
            <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-3">
              {row.label}
            </dt>
            <dd className="text-sm leading-relaxed tabular-nums">
              {row.value ?? <span className="text-ink-3">not provided</span>}
              {row.label === "Deadline" && ambiguousDeadline && (
                <span className="ml-2 inline-block rounded-full border border-accent/40 px-2 py-px align-middle font-mono text-[9px] uppercase tracking-[0.12em] text-accent">
                  confirm exact date
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {e.notes && <p className="mt-3 text-sm italic leading-relaxed text-ink-2">Note: {e.notes}</p>}
      {result.timelineNote && (
        <p className="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-3.5 py-2.5 text-[13px] leading-relaxed">
          {result.timelineNote}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------- 02 recommendations

function Recommendations({ result }: { result: PipelineResult }) {
  if (result.noMatch) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-card p-5">
        <p className="text-[15px] leading-relaxed">{result.noMatch.reason}</p>
        {result.noMatch.nearestFamilies.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
              Nearest families
            </span>
            {result.noMatch.nearestFamilies.map((f) => (
              <Badge key={f} variant="secondary" className="font-mono text-[10px] uppercase tracking-[0.1em]">
                {f}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (result.recommendations.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-card p-5 text-sm text-ink-3">
        No recommendation ran: the extract was empty.
      </p>
    );
  }

  const top = result.recommendations.slice(0, 3);
  const rest = result.recommendations.slice(3);

  return (
    <div>
      <ol className="space-y-4">
        {top.map((rec) => (
          <RecommendationCard key={rec.product.url} rec={rec} />
        ))}
      </ol>
      {rest.length > 0 && (
        <details className="group mt-4">
          <summary className="hit flex w-fit cursor-pointer list-none items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-3 transition-colors duration-150 ease-out hover:text-ink [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="inline transition-transform duration-200 ease-out group-open:rotate-45">+</span>
            {rest.length} more ranked catalogue matches
          </summary>
          <ol className="mt-4 space-y-4">
            {rest.map((rec) => (
              <RecommendationCard key={rec.product.url} rec={rec} />
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const p = rec.product;
  const spec = [
    p.material,
    p.gsm !== null ? `${p.gsm} GSM` : null,
    p.printMethod,
    p.moq !== null ? `MOQ ${p.moq.toLocaleString("en-IN")}` : null,
    p.leadTime ? `lead ${p.leadTime}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-1 font-serif text-[19px] font-semibold tracking-tight underline-offset-4 hover:underline"
        >
          {p.name}
          <ArrowUpRight className="size-3.5 opacity-40 transition-opacity duration-150 ease-out group-hover:opacity-100" />
        </a>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
          {p.familyLabel}
        </span>
      </div>
      {p.tagline && <p className="mt-1 text-sm italic leading-relaxed text-ink-2">{p.tagline}</p>}
      <p className="mt-2.5 font-mono text-xs leading-relaxed text-ink-3">{spec}</p>

      {(rec.evidence.length > 0 || rec.flags.length > 0) && (
        <ul className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3">
          {rec.evidence.map((ev, i) => (
            <EvidenceLine key={i} label={ev.label} />
          ))}
          {rec.flags.map((flag, i) => (
            <li key={i} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-accent">
              <span aria-hidden className="font-semibold">!</span>
              <span>{flag}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function EvidenceLine({ label }: { label: string }) {
  const positive = label.startsWith("✓");
  return (
    <li className="flex items-start gap-2 text-[13.5px] leading-relaxed">
      <span aria-hidden className={cn("font-semibold", positive ? "text-sage" : "text-ink-3")}>
        {positive ? "✓" : "·"}
      </span>
      <span>{positive ? label.replace(/^✓\s*/, "") : label}</span>
    </li>
  );
}

// -------------------------------------------------------------- 03 similar jobs

function SimilarJobs({ result }: { result: PipelineResult }) {
  if (result.similarJobs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-card p-5 text-sm text-ink-3">
        No comparable public portfolio records found.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {result.similarJobs.map(({ record, reasons }) => (
        <li key={record.url} className="flex flex-col rounded-xl border border-line bg-card p-5">
          <a
            href={record.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex w-fit items-center gap-1 font-serif text-[16px] font-semibold tracking-tight underline-offset-4 hover:underline"
          >
            {record.brandName}
            <ArrowUpRight className="size-3 opacity-40 transition-opacity duration-150 ease-out group-hover:opacity-100" />
          </a>
          <p className="mt-1 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ink-3">
            {[record.category, record.city, record.caseNumber].filter(Boolean).join(", ")}
          </p>
          {reasons.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {reasons.map((reason) => (
                <li key={reason} className="flex gap-1.5 text-[13px] leading-relaxed text-ink-2">
                  <span aria-hidden className="text-ink-3">·</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
          {(record.outcomeStat || record.clientQuote) && (
            <div className="mt-auto pt-3">
              {record.outcomeStat && (
                <p className="font-mono text-xs tabular-nums text-sage">
                  {record.outcomeStat}
                  {record.outcomeLabel ? ` ${record.outcomeLabel}` : ""}
                </p>
              )}
              {record.clientQuote && (
                <p className="mt-1.5 border-l-2 border-line pl-3 text-[13px] italic leading-relaxed text-ink-2">
                  “{record.clientQuote}”
                </p>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------ 04 still required

function StillRequired({ result }: { result: PipelineResult }) {
  if (result.missing.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-card p-5 text-[15px] text-ink-3">
        Nothing. The brief is complete.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line/60 overflow-hidden rounded-xl border border-line bg-card">
      {result.missing.map((m) => (
        <li key={m.id} className="flex items-start gap-3 px-4 py-3 text-sm leading-relaxed">
          <span aria-hidden className="mt-1 inline-block size-3.5 shrink-0 rounded-[3px] border border-ink-3/70" />
          <span>{m.label}</span>
        </li>
      ))}
    </ul>
  );
}

// --------------------------------------------------------- 05 artwork readiness

function ArtworkReadiness({ triage, onClear }: { triage: ArtworkTriage; onClear: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <VerdictBadge verdict={triage.verdict} />
        <span className="font-mono text-xs text-ink-3">
          {triage.filename ?? "link"} ({triage.source} {triage.kind})
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove artwork"
          className="hit ml-auto font-mono text-[10px] uppercase tracking-wider text-ink-3 underline-offset-2 transition-colors duration-150 ease-out hover:text-ink hover:underline"
        >
          Remove
        </button>
      </div>

      <ul className="mt-4 space-y-2.5 border-t border-dashed border-line pt-4">
        {triage.checks.map((check, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
            <span
              aria-hidden
              className={cn(
                "w-4 shrink-0 text-center font-semibold",
                check.status === "pass" && "text-sage",
                check.status === "review" && "text-accent",
                check.status === "blocker" && "text-destructive",
              )}
            >
              {check.status === "pass" ? "✓" : check.status === "review" ? "!" : "✗"}
            </span>
            <span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                {check.item}
              </span>
              {": "}
              {check.detail}
            </span>
          </li>
        ))}
      </ul>

      <blockquote className="mt-4 border-l-2 border-line pl-3.5 text-[13px] italic leading-relaxed text-ink-3">
        “{triage.rulesQuote}”
        <footer className="mt-1.5 font-mono text-[10px] not-italic uppercase tracking-[0.12em]">
          From{" "}
          <a
            href={triage.rulesSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors duration-150 ease-out hover:text-ink"
          >
            roopac.com FAQ
          </a>
        </footer>
      </blockquote>
    </div>
  );
}

// ---------------------------------------------------------------- 07 whatsapp

function ReplyPanel({ reply }: { reply: ReplyState }) {
  if (reply.loading) {
    return (
      <p className="animate-pulse font-mono text-xs uppercase tracking-[0.16em] text-ink-3">
        Drafting reply…
      </p>
    );
  }

  if (!reply.draft) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-card p-5 text-sm leading-relaxed text-ink-2">
        WhatsApp draft unavailable{reply.error ? `: ${reply.error}` : ""}. The job brief above is
        complete and ready to work from.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-sage/40 bg-sage-bg/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink">
            WhatsApp reply
          </span>
          <span className="rounded-full border border-accent/40 px-2 py-px font-mono text-[9px] uppercase tracking-[0.12em] text-accent">
            draft: review before sending
          </span>
        </div>
        <CopyButton text={reply.draft} label="Copy draft" toastText="Draft copied" />
      </div>
      <div className="mt-3 whitespace-pre-wrap border-t border-sage/25 pt-3 text-[15px] leading-relaxed">
        {reply.draft}
      </div>
    </div>
  );
}
