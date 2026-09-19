/**
 * Tiny lead-time parser for the timeline reality check. "3 weeks" → 21 days.
 * (audit/durations.ts is the fuller normalizer for the auditor; this one is
 * deliberately minimal for the brief's lead-window check.)
 */
export function parseLeadTimeDays(leadTime: string | null | undefined): number | null {
  if (!leadTime) return null;
  const m = leadTime
    .toLowerCase()
    .replace(/about|within|~|approximately|approx\.?/g, "")
    .trim()
    .match(/(\d+)\s*(day|week|working day|business day)s?/);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2].startsWith("week")) return n * 7;
  if (m[2].startsWith("working") || m[2].startsWith("business")) return Math.ceil((n * 7) / 5);
  return n;
}
