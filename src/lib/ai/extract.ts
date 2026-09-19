import { generateObject, NoObjectGeneratedError } from "ai";
import { getModel, MissingApiKeyError } from "./provider";
import { makeEnquiryExtractSchema, type EnquiryExtract } from "./schema";
import { getFamilySlugs } from "../data/loaders";

/**
 * Extraction: one messy customer message in, one EnquiryExtract out.
 * Exactly one LLM call (retry once on malformed/failed output). No chat history.
 */

export class ExtractionError extends Error {
  code: "no_object" | "api" | "missing_key";
  constructor(code: "no_object" | "api" | "missing_key", message: string) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
  }
}

type GenerateFn = typeof generateObject;

const SYSTEM = `You extract structured requirements from a raw customer enquiry for ROOPAC, a custom printing and packaging company in Tiruppur, India (paper bags, boxes, mailers, labels, stickers, stationery).

Rules:
- Extract ONLY what the message states. Never guess. If a field is absent, it is null (or an empty array).
- Quantities written as words ("five hundred", "ஐநூறு") become digits.
- A vague deadline ("next month", "asap", "before Deepavali") leaves \`deadline\` null and preserves the exact wording in \`deadlineText\`. Only a concrete date ("by March 5", "12th") may set \`deadline\` (year: assume the nearest future date).
- The customer may write in English, Tamil script, Tanglish (Tamil in Latin script), or a mix — set \`language\` accordingly; "mixed" when scripts/languages are interleaved.
- Map the customer's business to the closest Roopac industry enum value; when nothing fits, use null and keep their wording in \`industryRaw\`.
- \`families\` must only contain enum values that genuinely match what was asked; keep the original wording in \`familiesRaw\`.
- "logo iruku" / "logo attached" means artwork.mentioned = true.
- Colours = number of print colours they want (e.g. "2 colour print" → 2), not the colours of the product.`;

export async function extractRequirements(
  message: string,
  deps: { generate?: GenerateFn } = {},
): Promise<EnquiryExtract> {
  const generate = deps.generate ?? generateObject;
  const schema = makeEnquiryExtractSchema(await getFamilySlugs());

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object } = await generate({
        model: getModel(),
        schema,
        schemaName: "EnquiryExtract",
        temperature: 0,
        maxOutputTokens: 1200,
        system: SYSTEM,
        prompt: message,
      });
      const parsed = schema.parse(object);
      return { ...parsed, language: correctLanguage(message, parsed.language) };
    } catch (err) {
      if (err instanceof MissingApiKeyError) throw new ExtractionError("missing_key", err.message);
      lastError = err;
      if (attempt === 0) continue; // exactly one retry for malformed/failed responses
    }
  }
  if (NoObjectGeneratedError.isInstance(lastError))
    throw new ExtractionError("no_object", "The model could not produce a valid extraction after a retry.");
  throw new ExtractionError("api", lastError instanceof Error ? lastError.message : String(lastError));
}

/**
 * Script-based language correction — pure function over the raw message.
 * gpt-4o-mini is unstable on the tanglish/mixed boundary (it flips both ways
 * across runs), but the Tamil-script test is deterministic: Unicode U+0B80–U+0BFF.
 * Only the english-vs-tanglish call (Tamil words in Latin script — word
 * knowledge) stays with the model.
 */
export function correctLanguage(message: string, modelLanguage: EnquiryExtract["language"]): EnquiryExtract["language"] {
  const hasTamilScript = /[\u0B80-\u0BFF]/.test(message);
  const hasLatinLetters = /[A-Za-z]/.test(message);
  if (hasTamilScript && hasLatinLetters) return "mixed";
  if (hasTamilScript) return "tamil";
  // Latin-only: the model owns english-vs-tanglish (word knowledge). A
  // tamil/mixed vote on Latin-only text means it read Tamil words in Latin
  // script — tanglish is the only consistent label.
  if (modelLanguage === "tamil" || modelLanguage === "mixed") return "tanglish";
  return modelLanguage;
}
