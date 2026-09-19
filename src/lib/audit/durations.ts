/**
 * Duration wording normalizer for the catalogue auditor — pure functions only.
 *
 * Units: a duration is stored as { minDays, maxDays, unit } where unit is
 * "calendar" or "business". Business/working days are NOT calendar days, so
 * they keep their own unit and are converted explicitly via `toCalendarDays`.
 *
 * Conversion assumption (documented per task): business days map to calendar
 * days at a 7/5 ratio (a 5-day work week spans 7 calendar days), rounding each
 * end of the range UP so a promise is never understated:
 *   14 working days   -> ceil(14 * 7 / 5) = 20 calendar days
 *    5-7 business days -> 7..10 calendar days (the range is kept, not collapsed)
 *
 * Tolerated hedges: "about", "around", "approximately", "approx", "within",
 * "up to", "~" — they do not change the parsed day span.
 * Word numbers one..thirty are supported ("Four steps. Fourteen days.").
 * Hours ("48 hours", "2 hours") are intentionally NOT durations here: proof and
 * response SLAs are not order turnarounds.
 */

export type DurationUnit = "calendar" | "business";

export interface ParsedDuration {
  /** Lower bound in `unit` days (not calendar days when unit is "business"). */
  minDays: number;
  /** Upper bound in `unit` days (not calendar days when unit is "business"). */
  maxDays: number;
  unit: DurationUnit;
}

export interface DurationMatch {
  /** The matched phrase, trimmed, e.g. "about 3 weeks" or "5-7 business days". */
  phrase: string;
  /** Character offset of the phrase in the (whitespace-normalised) input. */
  index: number;
  duration: ParsedDuration;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  "twenty-one": 21,
  "twenty-two": 22,
  "twenty-three": 23,
  "twenty-four": 24,
  "twenty-five": 25,
  "twenty-six": 26,
  "twenty-seven": 27,
  "twenty-eight": 28,
  "twenty-nine": 29,
  thirty: 30,
};

// Longest word first so "fourteen" is preferred over the prefix "four".
const NUMBER_ALT = [...Object.keys(WORD_NUMBERS), "\\d{1,3}"]
  .sort((a, b) => b.length - a.length)
  .join("|");

const HEDGE = "(?:about|around|approximately|approx|within|up to|~)?";
const RANGE_SEP = "\\s*(?:-{1,2}|–|—|to)\\s*";
const NUMBER = `(${NUMBER_ALT})`;
const UNIT = `(working|business)?\\s*(days?|weeks?)`;

const DURATION_RE = new RegExp(
  `\\b${HEDGE}\\s*${NUMBER}(?:${RANGE_SEP}${NUMBER})?(?:\\s+|-)${UNIT}\\b`,
  "gi",
);

/**
 * Snapshot copy glues words to numbers ("Pan-India delivery14 working days.",
 * "Standard5-7 business days"). Insert a space at letter/digit joins so the
 * grammar can see the number; display quotes elsewhere stay verbatim.
 */
function normalizeForParsing(text: string): string {
  return text
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");
}

function parseNumber(token: string): number {
  const word = token.toLowerCase();
  if (word in WORD_NUMBERS) return WORD_NUMBERS[word];
  return Number.parseInt(token, 10);
}

function toDuration(m: RegExpExecArray): ParsedDuration {
  const min = parseNumber(m[1]);
  const max = m[2] !== undefined ? parseNumber(m[2]) : min;
  const isWeeks = /^week/i.test(m[4]);
  const scale = isWeeks ? 7 : 1;
  return { minDays: min * scale, maxDays: max * scale, unit: m[3] ? "business" : "calendar" };
}

/**
 * Parse the first duration phrase in `text`.
 * Returns null when no day/week duration is present (e.g. "48 hours").
 */
export function parseDuration(text: string): ParsedDuration | null {
  return extractDurations(text)[0]?.duration ?? null;
}

/**
 * Task-facing helper: parse `text` and convert business/working days to their
 * calendar equivalent (7/5 ratio, rounded up) so values from different unit
 * systems can be compared directly. See module docs for the assumption.
 */
export function parseDurationDays(text: string): { minDays: number; maxDays: number } | null {
  const d = parseDuration(text);
  return d ? toCalendarDays(d) : null;
}

/** Convert a duration to calendar days; business days at 7/5, rounded up. */
export function toCalendarDays(d: ParsedDuration): { minDays: number; maxDays: number } {
  if (d.unit === "calendar") return { minDays: d.minDays, maxDays: d.maxDays };
  return {
    minDays: Math.ceil((d.minDays * 7) / 5),
    maxDays: Math.ceil((d.maxDays * 7) / 5),
  };
}

/** Find every duration phrase in `text`, left to right, non-overlapping. */
export function extractDurations(text: string): DurationMatch[] {
  const haystack = normalizeForParsing(text);
  const matches: DurationMatch[] = [];
  DURATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DURATION_RE.exec(haystack)) !== null) {
    const min = parseNumber(m[1]);
    const max = m[2] !== undefined ? parseNumber(m[2]) : min;
    const isWeeks = /^week/i.test(m[4]);
    const scale = isWeeks ? 7 : 1;
    matches.push({
      phrase: m[0].trim(),
      index: m.index,
      duration: {
        minDays: min * scale,
        maxDays: max * scale,
        unit: m[3] ? "business" : "calendar",
      },
    });
  }
  DURATION_RE.lastIndex = 0;
  return matches;
}
