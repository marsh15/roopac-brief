import { cn } from "@/lib/utils";

/**
 * The real pipeline stages. /api/brief is a single call, so this is honest:
 * while in flight only the first row reads "in flight"; when the response
 * lands the stages light up in sequence around it — no fake progress bar.
 */
export default function StageTracker({
  stages,
  done,
  building,
}: {
  stages: string[];
  done: number;
  building: boolean;
}) {
  return (
    <ol
      aria-label="Pipeline stages"
      className="mt-4 space-y-1.5 border-t border-dashed border-line pt-4 font-mono text-[10.5px] uppercase tracking-[0.16em]"
    >
      {stages.map((stage, i) => {
        const isDone = i < done;
        const isActive = building && i === Math.min(done, stages.length - 1);
        return (
          <li key={stage} className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn("w-4 text-right", isDone ? "text-sage" : "text-ink-3")}
            >
              {isDone ? "✓" : String(i + 1).padStart(2, "0")}
            </span>
            <span className={cn(isDone || isActive ? "text-ink" : "text-ink-3")}>{stage}</span>
            <span aria-hidden className="flex-1 border-b border-dotted border-line" />
            <span
              className={cn(
                "w-16 text-right",
                isDone ? "text-sage" : isActive ? "animate-pulse text-ink-3" : "text-ink-3",
              )}
            >
              {isDone ? "done" : isActive ? "in flight" : "queued"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
