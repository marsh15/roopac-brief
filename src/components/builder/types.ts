/**
 * Wire contracts for the UI, mirrored from the API responses:
 *  - POST /api/brief  → PipelineResult (src/lib/pipeline/run.ts)
 *  - POST /api/artwork → { triage } (src/lib/artwork.ts)
 *  - POST /api/reply  → { draft } (route owned by another task)
 * Deliberately decoupled from the server modules — the UI talks HTTP only.
 */

export interface EnquiryExtract {
  language: "english" | "tamil" | "tanglish" | "mixed";
  industry: string | null;
  industryRaw: string | null;
  city: string | null;
  quantity: number | null;
  families: string[];
  familiesRaw: string[];
  sizes: string[];
  usage: string | null;
  positioning: "premium" | "balanced" | "economy" | null;
  colours: number | null;
  deadline: string | null;
  deadlineText: string | null;
  artwork: { mentioned: boolean; kinds: string[]; note: string | null };
  notes: string | null;
}

export interface RecommendationProduct {
  name: string;
  url: string;
  family: string;
  familyLabel: string;
  tagline: string | null;
  material: string | null;
  thickness: string | null;
  gsm: number | null;
  sizes: string[];
  printMethod: string | null;
  printOptions: string[];
  maxColors: number | null;
  moq: number | null;
  leadTime: string | null;
  turnaround: { value: string | null; priority: string | null; note: string | null } | null;
  benefits: string[];
  sourceUrl: string;
}

export interface Recommendation {
  product: RecommendationProduct;
  /** Ranking weight only — never surfaced to users. */
  score: number;
  evidence: { label: string }[];
  flags: string[];
}

export interface SimilarJobRecord {
  brandName: string;
  category: string;
  city: string | null;
  caseNumber: string | null;
  url: string;
  clientQuote: string | null;
  outcomeStat: string | null;
  outcomeLabel: string | null;
}

export interface SimilarJob {
  record: SimilarJobRecord;
  reasons: string[];
}

export interface PipelineResult {
  jobNumber: string;
  extract: EnquiryExtract;
  recommendations: Recommendation[];
  noMatch: { reason: string; nearestFamilies: string[] } | null;
  similarJobs: SimilarJob[];
  missing: { id: string; label: string }[];
  timelineNote: string | null;
  brief: string;
}

export type CheckStatus = "pass" | "review" | "blocker";

export interface ArtworkCheck {
  item: string;
  status: CheckStatus;
  detail: string;
}

export interface ArtworkTriage {
  source: "upload" | "link";
  kind: string;
  filename: string | null;
  checks: ArtworkCheck[];
  rulesQuote: string;
  rulesSourceUrl: string;
  verdict: CheckStatus;
}

export interface ApiError {
  code: string;
  message: string;
}

/** Artwork attach state, owned by Builder and shared by composer + results. */
export interface ArtworkState {
  fileName: string | null;
  triage: ArtworkTriage | null;
  checking: boolean;
  error: string | null;
}

/** WhatsApp draft state, owned by Builder. */
export interface ReplyState {
  draft: string | null;
  error: string | null;
  loading: boolean;
}
