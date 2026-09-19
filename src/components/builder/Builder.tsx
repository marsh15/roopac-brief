"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FIXTURES } from "@/lib/ai/fixtures";
import { Button } from "@/components/ui/button";
import Composer from "./Composer";
import ResultView from "./ResultView";
import StageTracker from "./StageTracker";
import type { ApiError, ArtworkState, PipelineResult, ReplyState } from "./types";

const STAGES = ["Extraction", "Catalogue match", "Similar jobs", "Brief"];
const MAX_ARTWORK_BYTES = 10 * 1024 * 1024; // mirrors the API's limit

const NO_ARTWORK: ArtworkState = { fileName: null, triage: null, checking: false, error: null };

async function readError(res: Response): Promise<ApiError> {
  try {
    const data = (await res.json()) as { error?: { code?: unknown; message?: unknown } };
    if (data.error && typeof data.error.message === "string") {
      return {
        code: typeof data.error.code === "string" ? data.error.code : "unknown",
        message: data.error.message,
      };
    }
  } catch {
    // fall through to the generic message
  }
  return { code: `http_${res.status}`, message: `Request failed (${res.status}).` };
}

export default function Builder() {
  const [message, setMessage] = useState("");
  const [building, setBuilding] = useState(false);
  const [stagesDone, setStagesDone] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [artwork, setArtwork] = useState<ArtworkState>(NO_ARTWORK);
  const [reply, setReply] = useState<ReplyState>({ draft: null, error: null, loading: false });

  const cascadeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timers = cascadeTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const clearCascade = () => {
    cascadeTimers.current.forEach(clearTimeout);
    cascadeTimers.current = [];
  };

  const build = useCallback(async () => {
    const text = message.trim();
    if (!text || building) return;
    clearCascade();
    setBuilding(true);
    setError(null);
    setStagesDone(0);

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        setError(await readError(res));
        setBuilding(false);
        return;
      }

      const data = (await res.json()) as PipelineResult;
      setResult(data);
      setBuilding(false);
      // One network call — so the stages light up in sequence only once the
      // response has actually landed. Honest, just staggered.
      for (let i = 1; i <= STAGES.length; i++) {
        cascadeTimers.current.push(setTimeout(() => setStagesDone(i), i * 140));
      }

      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // WhatsApp draft — best effort; on any failure we keep the brief and note it.
      setReply({ draft: null, error: null, loading: true });
      try {
        const replyRes = await fetch("/api/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pipeline: data }),
        });
        if (!replyRes.ok) {
          const err = await readError(replyRes);
          setReply({ draft: null, error: err.code === "missing_key" ? "OPENAI_API_KEY not configured" : err.message, loading: false });
          return;
        }
        const payload = (await replyRes.json()) as { draft?: unknown };
        if (typeof payload.draft !== "string" || payload.draft.trim() === "") {
          throw new Error("empty draft");
        }
        setReply({ draft: payload.draft, error: null, loading: false });
      } catch (err) {
        setReply({
          draft: null,
          error: err instanceof Error ? err.message : "draft request failed",
          loading: false,
        });
      }
    } catch {
      setError({ code: "network", message: "Could not reach the brief API — check the server and try again." });
      setBuilding(false);
    }
  }, [message, building]);

  const attachArtwork = useCallback(async (file: File) => {
    if (file.size > MAX_ARTWORK_BYTES) {
      setArtwork({
        fileName: file.name,
        triage: null,
        checking: false,
        error: "That file is over the 10 MB limit — export smaller, or share a Canva/Drive link with sales.",
      });
      return;
    }
    setArtwork({ fileName: file.name, triage: null, checking: true, error: null });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/artwork", { method: "POST", body: form });
      if (!res.ok) {
        throw new Error((await readError(res)).message);
      }
      const data = (await res.json()) as { triage?: unknown };
      if (!data.triage || typeof data.triage !== "object") {
        throw new Error("unexpected triage response");
      }
      setArtwork({ fileName: file.name, triage: data.triage as ArtworkState["triage"], checking: false, error: null });
    } catch (err) {
      setArtwork({
        fileName: file.name,
        triage: null,
        checking: false,
        error: err instanceof Error ? err.message : "Artwork check failed.",
      });
    }
  }, []);

  const clearArtwork = useCallback(() => setArtwork(NO_ARTWORK), []);

  return (
    <div className="grid gap-10 py-10 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-14">
      <div className="self-start lg:sticky lg:top-8">
        <Composer
          message={message}
          onMessageChange={setMessage}
          onBuild={build}
          building={building}
          artwork={artwork}
          onArtworkFile={attachArtwork}
          onArtworkClear={clearArtwork}
        />
        {(building || stagesDone > 0) && (
          <StageTracker stages={STAGES} done={stagesDone} building={building} />
        )}
        {error && <ErrorBanner error={error} />}
      </div>

      <div ref={resultsRef} className="min-w-0 scroll-mt-6">
        {result ? (
          <ResultView
            result={result}
            triage={artwork.triage}
            onArtworkClear={clearArtwork}
            reply={reply}
          />
        ) : (
          <EmptyState onPickSample={setMessage} />
        )}
      </div>
    </div>
  );
}

function ErrorBanner({ error }: { error: ApiError }) {
  const missingKey = error.code === "missing_key";
  return (
    <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-destructive">
        {missingKey ? "Setup needed" : "Build failed"} · {error.code}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed">{error.message}</p>
      {missingKey && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Add <code className="font-mono">OPENAI_API_KEY</code> to{" "}
          <code className="font-mono">.env.local</code> and restart the dev server — extraction makes
          one small-model call per build.
        </p>
      )}
    </div>
  );
}

function EmptyState({ onPickSample }: { onPickSample: (message: string) => void }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
      <p className="font-serif text-[22px] tracking-tight">Nothing built yet.</p>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-3">
        Paste a customer enquiry on the left — messy, Tamil or Tanglish, half-finished — attach
        artwork if you have it, and press Build brief. Or start from a sample:
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {FIXTURES.map((f) => (
          <Button
            key={f.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            title={f.message}
            onClick={() => onPickSample(f.message)}
          >
            {f.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
