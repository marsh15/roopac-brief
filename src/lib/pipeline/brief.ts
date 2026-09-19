/**
 * Deterministic plain-text brief renderer. Every value is traceable to the
 * extract or the snapshot — no generated prose here (that's the WhatsApp
 * draft's job, and it's grounded separately).
 */
import type { EnquiryExtract } from "@/lib/ai/schema";
import type { Product } from "@/lib/data/schemas";

export interface RecommendationView {
  product: Pick<Product, "name" | "url" | "family" | "material" | "gsm" | "sizes" | "printMethod" | "moq" | "leadTime">;
  evidence: { label: string }[];
  flags: string[];
}

export interface SimilarJobView {
  record: { brandName: string; category: string | null; city: string | null; caseNumber: string | null; url: string };
  reasons: string[];
}

export interface BriefInput {
  jobNumber: string;
  date: string;
  extract: EnquiryExtract;
  recommendations: RecommendationView[];
  noMatch: { reason: string; nearestFamilies: string[] } | null;
  similarJobs: SimilarJobView[];
  missing: { id: string; label: string }[];
  timelineNote: string | null;
}

export function renderBrief(input: BriefInput): string {
  const { jobNumber, date, extract: e, recommendations, noMatch, similarJobs, missing, timelineNote } = input;
  const L: string[] = [];

  L.push("ROOPAC JOB BRIEF");
  L.push("=".repeat(56));
  L.push(`Job: ${jobNumber}    Date: ${date}`);
  L.push("");
  L.push("CUSTOMER");
  L.push(`  Industry: ${e.industry ?? e.industryRaw ?? "— (ask)"}`);
  L.push(`  City: ${e.city ?? "—"}`);
  L.push(`  Message language: ${e.language}`);
  if (e.usage) L.push(`  Use case: ${e.usage}`);
  L.push("");
  L.push("REQUIREMENT");
  L.push(`  Quantity: ${e.quantity ?? "— (ask)"}`);
  L.push(`  Print colours: ${e.colours ?? "—"}`);
  L.push(
    `  Sizes: ${e.sizes.length ? e.sizes.join(", ") : "—"}`,
  );
  L.push(`  Positioning: ${e.positioning ?? "—"}`);
  L.push(
    `  Deadline: ${e.deadline ?? (e.deadlineText ? `"${e.deadlineText}" (confirm exact date)` : "—")}`,
  );
  if (timelineNote) {
    L.push(`  Timeline check: ${timelineNote}`);
  }
  if (e.artwork.mentioned) {
    L.push(`  Artwork: mentioned${e.artwork.note ? ` — "${e.artwork.note}"` : ""}`);
  } else {
    L.push("  Artwork: not yet provided");
  }
  if (e.familiesRaw.length) L.push(`  Asked for (verbatim): ${e.familiesRaw.join(", ")}`);
  L.push("");
  L.push("RECOMMENDED PRODUCTS (from the live catalogue snapshot)");
  if (noMatch) {
    L.push(`  ${noMatch.reason}`);
    if (noMatch.nearestFamilies.length) L.push(`  Nearest families: ${noMatch.nearestFamilies.join(", ")}`);
  } else if (!recommendations.length) {
    L.push("  No recommendation ran (no extract).");
  } else {
    recommendations.forEach((r, i) => {
      L.push(`  ${i + 1}. ${r.product.name} — ${r.product.url}`);
      L.push(`     Spec: ${r.product.material ?? "material n/a"}${r.product.gsm ? `, ${r.product.gsm} GSM` : ""} | ${r.product.printMethod ?? "print n/a"} | MOQ ${r.product.moq ?? "?"} | lead ${r.product.leadTime ?? "?"}`);
      for (const ev of r.evidence) {
        L.push(`     - ${ev.label}`);
      }
      for (const flag of r.flags) L.push(`     ! ${flag}`);
    });
  }
  L.push("");
  L.push("SIMILAR ROOPAC WORK");
  if (!similarJobs.length) {
    L.push("  No comparable public portfolio records found.");
  } else {
    for (const s of similarJobs) {
      const place = s.record.city ? `, ${s.record.city}` : "";
      const caseNo = s.record.caseNumber ? ` (${s.record.caseNumber})` : "";
      L.push(`  - ${s.record.brandName}${place}${caseNo} — ${s.record.url}`);
      L.push(`    ${s.reasons.join("; ")}`);
    }
  }
  L.push("");
  L.push("STILL REQUIRED FROM CUSTOMER");
  if (!missing.length) {
    L.push("  Nothing — the enquiry is complete enough for a quote-ready brief.");
  } else {
    for (const m of missing) L.push(`  [ ] ${m.label}`);
  }
  L.push("");
  L.push("ARTWORK STATUS");
  L.push(`  ${e.artwork.mentioned ? "Customer has artwork — collect file/link." : "No artwork mentioned — request AI/PDF/PSD/EPS/PNG/JPG or Canva/Drive link."}`);
  L.push("");
  L.push("-".repeat(56));
  L.push("Grounded in the committed roopac.com snapshot; every spec above cites the product page URL.");

  return L.join("\n");
}
