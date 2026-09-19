import { describe, expect, it } from "vitest";
import { computeMissing, requiredFieldsByFamily } from "./missing";
import { renderBrief } from "./brief";
import { parseLeadTimeDays } from "./leadtime";
import { POST } from "@/app/api/brief/route";

const base = {
  language: "english" as const,
  industry: "Saree Boutique" as const,
  industryRaw: null,
  city: "Coimbatore",
  quantity: 500,
  families: ["paper-bag"],
  familiesRaw: ["carry bags"],
  sizes: ["16 × 13 × 5 in"],
  usage: "saree boutique carry bags",
  positioning: "premium" as const,
  colours: 2,
  deadline: null,
  deadlineText: null,
  artwork: { mentioned: true, kinds: ["file" as const], note: "logo attached" },
  notes: null,
};

describe("computeMissing", () => {
  it("lists nothing when a paper-bag enquiry is complete", () => {
    const missing = computeMissing({ ...base, deadline: "2026-11-01" });
    expect(missing).toHaveLength(0);
  });

  it("paper-bag rules: size, colours, artwork, deadline — only absent ones listed", () => {
    const missing = computeMissing({ ...base, sizes: [], colours: null, deadline: null });
    expect(missing.map((m) => m.id).sort()).toEqual(["colours", "deadline", "size"]);
  });

  it("vague deadline wording keeps the confirm-date item", () => {
    const missing = computeMissing({ ...base, deadlineText: "next month" });
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ id: "deadline", label: "Confirm exact required-by date" });
  });

  it("box families ask for dimensions and board spec", () => {
    const missing = computeMissing({
      ...base,
      families: ["monocarton"],
      sizes: [],
      colours: null,
      artwork: { mentioned: false, kinds: [], note: null },
      deadline: null,
    });
    const ids = missing.map((m) => m.id);
    expect(ids).toContain("dimensions");
    expect(ids).toContain("board");
  });

  it("no family matched → asks which product + quantity", () => {
    const missing = computeMissing({ ...base, families: [], quantity: null, deadline: "2026-11-01" });
    expect(missing.map((m) => m.id).sort()).toEqual(["family", "quantity"]);
  });

  it("every family rule set includes artwork + deadline", () => {
    for (const [family, rules] of Object.entries(requiredFieldsByFamily)) {
      const ids = rules.map((r) => r.id);
      expect(ids, family).toContain("artwork");
      expect(ids, family).toContain("deadline");
    }
  });
});

describe("parseLeadTimeDays", () => {
  it.each([
    ["3 weeks", 21],
    ["2 weeks", 14],
    ["about 3 weeks", 21],
    ["10 days", 10],
    ["14 working days", 20],
    [null, null],
    ["—", null],
  ])("%s → %s", (input, expected) => {
    expect(parseLeadTimeDays(input)).toBe(expected);
  });
});

describe("renderBrief", () => {
  const input = {
    jobNumber: "RB-20260919-001",
    date: "2026-09-19",
    extract: base,
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
    similarJobs: [
      {
        record: {
          brandName: "Kee & You",
          category: "Women's Tailoring",
          city: "Mysore",
          caseNumber: "09",
          url: "https://roopac.com/portfolio/kee-and-you",
        },
        reasons: ["same industry: Women's Tailoring"],
      },
    ],
    missing: [{ id: "deadline", label: "Confirm exact required-by date" }],
    timelineNote: 'Customer said "next month" — confirm an exact date before promising.',
  };

  it("renders all sections with traceable values", () => {
    const brief = renderBrief(input);
    expect(brief).toContain("ROOPAC JOB BRIEF");
    expect(brief).toContain("Job: RB-20260919-001");
    expect(brief).toContain("Industry: Saree Boutique");
    expect(brief).toContain("City: Coimbatore");
    expect(brief).toContain("Vogue on RedBull — https://roopac.com/products/vogue-on-redbull");
    expect(brief).toContain("230 GSM");
    expect(brief).toContain("✓ MOQ 300 ≤ your 500");
    expect(brief).toContain("Kee & You");
    expect(brief).toContain("[ ] Confirm exact required-by date");
    expect(brief).toContain("Timeline check");
  });

  it("renders noMatch and empty missing-list variants", () => {
    const brief = renderBrief({
      ...input,
      recommendations: [],
      noMatch: { reason: "no catalogue match — tell us more", nearestFamilies: ["paper-bag"] },
      similarJobs: [],
      missing: [],
    });
    expect(brief).toContain("no catalogue match");
    expect(brief).toContain("Nothing — the enquiry is complete enough");
  });
});

describe("POST /api/brief validation", () => {
  const req = (body: unknown) =>
    new Request("http://localhost/api/brief", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });

  it("rejects an empty message with 400", async () => {
    const res = await POST(req({ message: "   " }));
    expect(res.status).toBe(400);
    const json: any = await res.json();
    expect(json.error.code).toBe("empty_message");
  });

  it("rejects an over-long message with 400", async () => {
    const res = await POST(req({ message: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    const json: any = await res.json();
    expect(json.error.code).toBe("message_too_long");
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/brief", {
        method: "POST",
        body: "{not json",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    const json: any = await res.json();
    expect(json.error.code).toBe("bad_json");
  });
});
