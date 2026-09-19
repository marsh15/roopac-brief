import { describe, expect, it, vi, beforeEach } from "vitest";
import { extractRequirements, ExtractionError } from "./extract";
import { makeEnquiryExtractSchema } from "./schema";
import { getFamilySlugs } from "../data/loaders";

// Schema strictness + retry behaviour, no network: the model call is mocked.
// A dummy API key satisfies the call-time key check; no request is made.
// The smoke test (npm run smoke:extract) covers the live API.

beforeEach(() => {
  if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = "test-key-not-real";
});

const validExtract = {
  language: "tanglish",
  industry: "Saree Boutique",
  industryRaw: null,
  city: "Chennai",
  quantity: 500,
  families: ["paper-bag"],
  familiesRaw: ["paper bag"],
  sizes: [],
  usage: "boutique",
  positioning: null,
  colours: null,
  deadline: null,
  deadlineText: null,
  artwork: { mentioned: true, kinds: ["other"], note: "logo iruku" },
  notes: null,
};

describe("EnquiryExtract schema strictness", () => {
  it("accepts a complete valid extract", async () => {
    const schema = makeEnquiryExtractSchema(await getFamilySlugs());
    expect(() => schema.parse(validExtract)).not.toThrow();
  });

  it("rejects a response missing required keys", async () => {
    const schema = makeEnquiryExtractSchema(await getFamilySlugs());
    const { artwork, ...withoutArtwork } = validExtract;
    expect(() => schema.parse(withoutArtwork)).toThrow();
  });

  it("rejects a family outside the snapshot enum", async () => {
    const schema = makeEnquiryExtractSchema(await getFamilySlugs());
    expect(() => schema.parse({ ...validExtract, families: ["carrier-rocket"] })).toThrow();
  });

  it("rejects a non-integer quantity", async () => {
    const schema = makeEnquiryExtractSchema(await getFamilySlugs());
    expect(() => schema.parse({ ...validExtract, quantity: 12.5 })).toThrow();
  });
});

describe("extractRequirements", () => {
  it("returns the parsed extract from the model", async () => {
    const generate = vi.fn().mockResolvedValue({ object: validExtract });
    const result = await extractRequirements("enaku 500 bag venum", { generate: generate as any });
    expect(result.quantity).toBe(500);
    expect(result.city).toBe("Chennai");
    expect(generate).toHaveBeenCalledTimes(1);
    // temperature 0, single call, no chat history
    expect(generate.mock.calls[0][0]).toMatchObject({ temperature: 0 });
    expect(String((generate.mock.calls[0][0] as any).prompt)).toContain("500");
  });

  it("retries once after a malformed response, then succeeds", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("No object generated: JSON parse failed"))
      .mockResolvedValueOnce({ object: validExtract });
    const result = await extractRequirements("hello", { generate: generate as any });
    expect(result.quantity).toBe(500);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("throws ExtractionError(no_object) after two malformed responses", async () => {
    const { NoObjectGeneratedError } = await import("ai");
    const err = new NoObjectGeneratedError({ message: "No object generated", text: "", reason: "parse-error" });
    const generate = vi.fn().mockRejectedValue(err);
    await expect(extractRequirements("hello", { generate: generate as any })).rejects.toMatchObject({
      code: "no_object",
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("wraps a missing API key in ExtractionError(missing_key)", async () => {
    const key = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(extractRequirements("hello")).rejects.toMatchObject({ code: "missing_key" });
    } finally {
      if (key !== undefined) process.env.OPENAI_API_KEY = key;
    }
  });

  it("throws ExtractionError(api) for non-object failures", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("429 rate limit exceeded"));
    await expect(extractRequirements("hello", { generate: generate as any })).rejects.toBeInstanceOf(
      ExtractionError,
    );
  });
});
