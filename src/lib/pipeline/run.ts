/**
 * The pipeline: extraction → matching → similar jobs → missing info → brief.
 * Exactly one remote call (extraction). Everything else is deterministic.
 */
import { extractRequirements } from "@/lib/ai/extract";
import type { EnquiryExtract } from "@/lib/ai/schema";
import { getPortfolio, getProducts } from "@/lib/data/loaders";
import { matchProducts, similarJobs } from "@/lib/match";
import { computeMissing } from "./missing";
import { parseLeadTimeDays } from "./leadtime";
import { renderBrief, type RecommendationView, type SimilarJobView } from "./brief";
import { nextJobNumber } from "./counter";

export interface PipelineResult {
  jobNumber: string;
  extract: EnquiryExtract;
  recommendations: RecommendationView[];
  noMatch: { reason: string; nearestFamilies: string[] } | null;
  similarJobs: SimilarJobView[];
  missing: { id: string; label: string }[];
  timelineNote: string | null;
  brief: string;
}

export async function runPipeline(message: string): Promise<PipelineResult> {
  const [extract, products, portfolio] = await Promise.all([
    extractRequirements(message),
    getProducts(),
    getPortfolio(),
  ]);

  const match = matchProducts(extract, products, portfolio);
  const jobs = similarJobs(extract, portfolio, 5, products);
  const missing = computeMissing(extract);

  const timelineNote = timelineCheck(extract, match.recommendations[0]?.product.leadTime ?? null);

  const jobNumber = await nextJobNumber();
  const brief = renderBrief({
    jobNumber,
    date: new Date().toISOString().slice(0, 10),
    extract,
    recommendations: match.recommendations,
    noMatch: match.noMatch,
    similarJobs: jobs,
    missing,
    timelineNote,
  });

  return {
    jobNumber,
    extract,
    recommendations: match.recommendations,
    noMatch: match.noMatch,
    similarJobs: jobs,
    missing,
    timelineNote,
    brief,
  };
}

/** Required date vs that product's lead time — surfaces a conflict, never blocks. */
function timelineCheck(extract: EnquiryExtract, topLeadTime: string | null): string | null {
  if (!extract.deadline) {
    return extract.deadlineText
      ? `Customer said "${extract.deadlineText}" — confirm an exact date before promising.`
      : null;
  }
  const leadDays = parseLeadTimeDays(topLeadTime);
  if (leadDays === null) return null;
  const required = new Date(extract.deadline);
  const ready = new Date(Date.now() + leadDays * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (ready > required) {
    return `Required ${fmt(required)} is INSIDE the lead window — top pick needs ~${leadDays} days (ready ≈ ${fmt(ready)}). Flag to customer.`;
  }
  return `Required ${fmt(required)} is achievable inside the ~${leadDays}-day lead window (ready ≈ ${fmt(ready)}).`;
}
