/**
 * WhatsApp reply draft: ONE OpenAI call grounded strictly in the pipeline
 * result — products by exact name from the recommendation set, missing
 * questions verbatim, lead-time facts from the snapshot. The UI presents the
 * output as a DRAFT for human approval. A post-check rejects any product
 * name that isn't in the recommendation set (hallucination guard): violations
 * trigger one retry, then a deterministic template fallback.
 */
import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";
import type { PipelineResult } from "./run";

type GenerateFn = typeof generateText;

export class DraftError extends Error {
  code: "missing_key" | "api";
  constructor(code: "missing_key" | "api", message: string) {
    super(message);
    this.name = "DraftError";
    this.code = code;
  }
}

export async function draftReply(
  result: PipelineResult,
  catalogNames: string[],
  deps: { generate?: GenerateFn } = {},
): Promise<string> {
  const generate = deps.generate ?? generateText;

  const grounding = {
    customer: {
      language: result.extract.language,
      industry: result.extract.industry,
      city: result.extract.city,
      quantity: result.extract.quantity,
      askedFor: result.extract.familiesRaw,
      deadlineText: result.extract.deadlineText,
    },
    recommendations: result.recommendations.map((r) => ({
      name: r.product.name,
      material: r.product.material,
      gsm: r.product.gsm,
      printMethod: r.product.printMethod,
      moq: r.product.moq,
      leadTime: r.product.leadTime,
      flags: r.flags,
    })),
    questionsToAsk: result.missing.map((m) => m.label),
    timelineNote: result.timelineNote,
  };

  const allowed = result.recommendations.map((r) => r.product.name);

  const buildPrompt = (violationNote?: string) =>
    [
      JSON.stringify(grounding, null, 2),
      "",
      "Write the WhatsApp reply to this customer as ROOPAC's sales assistant.",
      "Rules:",
      "- Reply in the customer's language/style (Tanglish stays Tanglish, Tamil stays Tamil, English stays English).",
      "- Warm, short, human — under 120 words. No greeting formality beyond 'Hi'/'Vanakkam'.",
      "- Mention ONLY products from the recommendation list, by their exact names.",
      "- Ask the missing-information questions naturally, close to the wording given.",
      "- Never quote a price. Never promise a date; you may reference the lead time.",
      "- No emojis more than one. No sign-off with a fake human name; end with '— Team ROOPAC'.",
      violationNote
        ? `\nIMPORTANT: your previous attempt named products outside the list (${violationNote}). Use only: ${allowed.join(", ") || "(no products — ask questions only)"}.`
        : "",
    ].join("\n");

  const violations = (text: string) => catalogNames.filter((n) => text.includes(n) && !allowed.includes(n));

  let lastText = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await generate({
        model: getModel(),
        temperature: 0.2,
        maxOutputTokens: 400,
        system: "You write grounded, honest customer replies for a packaging company. You never invent products, prices, or dates.",
        prompt: buildPrompt(attempt === 0 ? undefined : violations(lastText).join(", ")),
      });
      lastText = text.trim();
      if (violations(lastText).length === 0) return lastText;
    } catch (err: any) {
      if (err?.name === "MissingApiKeyError" || /OPENAI_API_KEY/.test(String(err?.message)))
        throw new DraftError("missing_key", err.message);
      if (attempt === 1) throw new DraftError("api", err?.message ?? String(err));
    }
  }
  return templateFallback(result);
}

/** Deterministic fallback — always valid, never creative. */
export function templateFallback(result: PipelineResult): string {
  const L: string[] = [];
  L.push("Vanakkam! Thanks for reaching out to ROOPAC.");
  if (result.recommendations.length) {
    const r = result.recommendations[0];
    const specs = [r.product.material, r.product.gsm ? `${r.product.gsm} GSM` : null, r.product.printMethod]
      .filter(Boolean)
      .join(", ");
    L.push(
      `For what you described, our pick is the ${r.product.name} (${specs}, MOQ ${r.product.moq}, lead ${r.product.leadTime}).`,
    );
    const others = result.recommendations.slice(1, 3).map((x) => x.product.name);
    if (others.length) L.push(`Also worth a look: ${others.join(" and ")}.`);
  }
  if (result.missing.length) {
    L.push(`To take this forward: ${result.missing.map((m) => m.label.toLowerCase()).join("; ")}.`);
  }
  if (result.timelineNote) L.push(result.timelineNote);
  L.push("— Team ROOPAC");
  return L.join("\n");
}
