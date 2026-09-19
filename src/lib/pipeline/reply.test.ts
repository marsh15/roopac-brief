import { describe, expect, it, vi, beforeEach } from "vitest";
import { draftReply, templateFallback } from "./reply";
import type { PipelineResult } from "./run";

beforeEach(() => {
  if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = "test-key-not-real";
});

const catalogNames = [
  "Vogue on RedBull",
  "Classic on Butterfly",
  "Kraft Mailer",
  "Black Poly Mailer",
  "Woven Labels",
];

const baseResult: PipelineResult = {
  jobNumber: "RB-20260919-001",
  extract: {
    language: "tanglish",
    industry: "Saree Boutique",
    industryRaw: null,
    city: "Chennai",
    quantity: 500,
    families: ["paper-bag"],
    familiesRaw: ["paper bag"],
    sizes: [],
    usage: null,
    positioning: "premium",
    colours: null,
    deadline: null,
    deadlineText: "Evalo naal aagum?",
    artwork: { mentioned: true, kinds: [], note: "logo iruku" },
    notes: null,
  },
  recommendations: [
    {
      product: {
        name: "Vogue on RedBull",
        url: "https://roopac.com/products/vogue-on-redbull",
        family: "paper-bag",
        material: "High Strength FBB Paper Board",
        gsm: 230,
        sizes: ["16 × 13 × 5 in"],
        printMethod: "Offset",
        moq: 300,
        leadTime: "3 weeks",
      },
      evidence: [{ label: "✓ MOQ 300 ≤ your 500" }],
      flags: [],
    },
  ],
  noMatch: null,
  similarJobs: [],
  missing: [{ id: "size", label: "Exact bag size (W × H × Gusset, in inches)" }],
  timelineNote: null,
  brief: "brief",
};

describe("draftReply", () => {
  it("accepts a grounded reply that names only recommended products", async () => {
    const generate = vi.fn().mockResolvedValue({
      text: "Hi! For your boutique, the Vogue on RedBull (230 GSM FBB) is perfect — MOQ 300, lead 3 weeks. What size bags do you need? — Team ROOPAC",
    });
    const draft = await draftReply(baseResult, catalogNames, { generate: generate as any });
    expect(draft).toContain("Vogue on RedBull");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("retries when the reply names a non-recommended catalogue product", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        text: "Check out the Classic on Butterfly and Vogue on RedBull — Team ROOPAC",
      })
      .mockResolvedValueOnce({ text: "The Vogue on RedBull suits you — Team ROOPAC" });
    const draft = await draftReply(baseResult, catalogNames, { generate: generate as any });
    expect(draft).toBe("The Vogue on RedBull suits you — Team ROOPAC");
    expect(generate).toHaveBeenCalledTimes(2);
    // the retry prompt carries the violation note
    const retryPrompt = String(generate.mock.calls[1][0].prompt);
    expect(retryPrompt).toContain("Classic on Butterfly");
    expect(retryPrompt).toContain("IMPORTANT");
  });

  it("falls back to the deterministic template after repeated violations", async () => {
    const generate = vi.fn().mockResolvedValue({
      text: "Buy Classic on Butterfly and Woven Labels now — Team ROOPAC",
    });
    const draft = await draftReply(baseResult, catalogNames, { generate: generate as any });
    expect(draft).toContain("Vogue on RedBull"); // from the recommendation
    expect(draft).toContain("exact bag size"); // missing question, lowercased
    expect(draft).toContain("— Team ROOPAC");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("template fallback never names non-recommended products", () => {
    const draft = templateFallback(baseResult);
    for (const name of catalogNames) {
      if (!baseResult.recommendations.some((r) => r.product.name === name)) {
        expect(draft).not.toContain(name);
      }
    }
  });
});
