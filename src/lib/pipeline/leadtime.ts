/**
 * Lead time → calendar days for the brief's timeline reality check. Reuses the
 * auditor's duration parser ("3 weeks" → 21, "14 working days" → ceil 7/5 = 20);
 * the far end of a range is the conservative wait.
 */
import { parseDuration, toCalendarDays } from "../audit/durations";

export function parseLeadTimeDays(leadTime: string | null | undefined): number | null {
  const d = leadTime ? parseDuration(leadTime) : null;
  return d ? toCalendarDays(d).maxDays : null;
}
