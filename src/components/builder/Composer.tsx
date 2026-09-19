"use client";

import { useRef } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { FIXTURES } from "@/lib/ai/fixtures";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import VerdictBadge from "./VerdictBadge";
import type { ArtworkState } from "./types";

const MAX_MESSAGE = 4000;
const ACCEPT = ".png,.jpg,.jpeg,.pdf,.ai,.eps,.psd";

export default function Composer({
  message,
  onMessageChange,
  onBuild,
  building,
  artwork,
  onArtworkFile,
  onArtworkClear,
}: {
  message: string;
  onMessageChange: (v: string) => void;
  onBuild: () => void;
  building: boolean;
  artwork: ArtworkState;
  onArtworkFile: (f: File) => void;
  onArtworkClear: () => void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);

  return (
    <section aria-label="Enquiry composer" className="rounded-xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <Label
          htmlFor="enquiry"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3"
        >
          Customer enquiry
        </Label>
        <span className="font-mono text-[10px] tabular-nums text-ink-3">
          {message.length}/{MAX_MESSAGE}
        </span>
      </div>
      <Textarea
        id="enquiry"
        value={message}
        maxLength={MAX_MESSAGE}
        onChange={(e) => onMessageChange(e.target.value)}
        placeholder="Paste it as it arrived: messy, Tamil or Tanglish, half-finished…"
        disabled={building}
        className="mt-2 min-h-[168px] resize-y border-line bg-transparent text-[15px] leading-relaxed focus-visible:ring-ring"
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">Samples</span>
        {FIXTURES.map((f) => (
          <Button
            key={f.id}
            type="button"
            variant="outline"
            size="sm"
            className="hit h-7 px-2.5 text-xs"
            title={f.message}
            onClick={() => onMessageChange(f.message)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="my-4 border-t border-dashed border-line" />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="hidden"
          aria-label="Attach artwork file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onArtworkFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hit h-7"
          onClick={() => fileInput.current?.click()}
        >
          <Paperclip /> Attach artwork
        </Button>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
          PNG, JPG, PDF, AI, EPS or PSD, up to 10 MB
        </span>
      </div>

      {artwork.checking && artwork.fileName && (
        <p className="mt-2 flex items-center gap-2 font-mono text-xs text-ink-3">
          <Loader2 className="size-3.5 animate-spin" /> Reading {artwork.fileName}…
        </p>
      )}
      {artwork.error && (
        <p className="mt-2 text-xs leading-relaxed text-accent" role="status">
          {artwork.error}
        </p>
      )}
      {artwork.triage && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-line px-3 py-2">
          <VerdictBadge verdict={artwork.triage.verdict} />
          <span className="min-w-0 truncate font-mono text-xs text-ink-3">
            {artwork.triage.filename ?? "link"} · {artwork.triage.checks.length} checks (full result
            below)
          </span>
          <button
            type="button"
            onClick={onArtworkClear}
            aria-label="Remove artwork"
            className="hit ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-3 underline-offset-2 transition-colors duration-150 ease-out hover:text-ink hover:underline"
          >
            <X className="size-3" /> Remove
          </button>
        </div>
      )}

      <Button type="button" size="lg" className="mt-5 w-full" disabled={building || message.trim().length === 0} onClick={onBuild}>
        {building ? "Building…" : "Build brief"}
      </Button>
    </section>
  );
}
