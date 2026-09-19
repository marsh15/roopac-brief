/**
 * Eval cases. The first three are the UI sample fixtures (Task 6) — demo and
 * evals can never silently diverge. Expected values cite snapshot facts
 * (MOQs etc. from data/products.json, verified in docs/roopac-research.md §2/§5),
 * so a catalogue change that breaks an eval is a real signal, not flakiness.
 *
 * Assertion shapes per case:
 *   expect            — exact-match assertions on the extract (deep-equal on the field)
 *   expectNull        — extract fields that must stay null (no invention check)
 *   expectMissingIds  — ids that must appear in the missing-info checklist
 *   expectNoMissing   — checklist must be empty
 *   expectFamilyInTop3 — at least one top-3 recommendation from this family
 *   expectNoMatch     — no-match result expected
 *   expectMoqFlagOnTop — top recommendation carries a flag containing this number
 *   expectIndustryInTop5SimilarJobs — expected industry appears in similar jobs
 */

export interface EvalCase {
  id: string;
  message: string;
  expect?: Record<string, unknown>;
  expectNull?: string[];
  expectMissingIds?: string[];
  expectNoMissing?: boolean;
  expectFamilyInTop3?: string;
  expectNoMatch?: boolean;
  expectMoqFlagOnTop?: number;
  expectIndustryInTop5SimilarJobs?: string;
}

export const CASES: EvalCase[] = [
  // ---- the three UI fixtures ----
  {
    id: "fixture-english",
    message:
      "Hi, opening a saree boutique in Coimbatore next month. Need around 500 premium carry bags with my logo, 2 colours. Can you share options? Also what details do you need from me?",
    expect: {
      language: "english",
      industry: "Saree Boutique",
      city: "Coimbatore",
      quantity: 500,
      families: ["paper-bag"],
      positioning: "premium",
      colours: 2,
    },
    expectNull: ["deadline"],
    expectMissingIds: ["size", "deadline"],
    expectFamilyInTop3: "paper-bag",
    expectIndustryInTop5SimilarJobs: "Saree Boutique",
  },
  {
    id: "fixture-tamil",
    message:
      "வணக்கம், எனக்கு கோவையில் புதிய சேலை கடை திறக்கப் போகுது. அதுக்கு 500 பேப்பர் பேக் வேணும், லோகோ அட்டச் பண்ணிட்டேன். விலை என்ன?",
    expect: {
      language: "tamil",
      industry: "Saree Boutique",
      city: "Coimbatore",
      quantity: 500,
      families: ["paper-bag"],
    },
    expectMissingIds: ["size", "deadline"],
    expectFamilyInTop3: "paper-bag",
  },
  {
    id: "fixture-tanglish",
    message: "Anna enaku 500 paper bag venum, boutique ku, logo iruku. Chennai la shop. Evalo naal aagum?",
    expect: {
      language: "tanglish",
      quantity: 500,
      families: ["paper-bag"],
      city: "Chennai",
    },
    expectMissingIds: ["size", "colours", "deadline"],
    expectFamilyInTop3: "paper-bag",
    expectIndustryInTop5SimilarJobs: "Saree Boutique",
  },

  // ---- extraction edge cases ----
  {
    id: "missing-quantity",
    message: "Enaku rigid box venum, Bangalore la bakery iruku",
    expect: { language: "tanglish", industry: "Food (Non-direct / Cafe)", city: "Bangalore", families: ["rigid"] },
    expectNull: ["quantity"],
    expectMissingIds: ["quantity", "dimensions"],
  },
  {
    id: "below-moq-paper-bag",
    message: "I need 150 classic paper bags for my saree shop, 1 colour print",
    expect: { quantity: 150, families: ["paper-bag"], colours: 1 },
    expectMoqFlagOnTop: 300,
  },
  {
    id: "below-moq-woven-labels",
    message: "500 woven labels for my garments brand in Tirupur",
    expect: { quantity: 500, families: ["fabric-label"], city: "Tirupur" },
    // family-level matching can't tell "woven" from "cotton" labels; cotton-labels
    // (MOQ 1000) is a legitimate top pick — what matters is that the MOQ flag fires
    expectMoqFlagOnTop: 1000,
  },
  {
    id: "unknown-product",
    message: "Do you print custom coffee mugs? Need 200 for my cafe",
    expect: { quantity: 200 },
    expectNoMatch: true,
  },
  {
    id: "two-products",
    message: "I have a textile shop in Coimbatore. Need 500 paper bags and 500 kraft mailers for online orders.",
    expect: {
      city: "Coimbatore",
      quantity: 500,
      families: ["paper-bag", "kraft-mailer"],
    },
    expectFamilyInTop3: "paper-bag",
  },
  {
    id: "vague-dimensions",
    message: "Need a medium size box for shipping my products, around 200 pieces",
    expect: { quantity: 200 },
    expectNull: ["positioning"],
  },
  {
    id: "bad-artwork-link",
    message:
      "Hi, I need 300 paper bags for my boutique in Madurai. My logo is at droppbox.com/logo-final.png please check",
    expect: { city: "Madurai", quantity: 300, families: ["paper-bag"] },
  },
  {
    id: "ambiguous-deadline",
    message: "Enaku 300 vogue bag venum, next month ku, Erode la boutique",
    expect: { language: "tanglish", quantity: 300, city: "Erode", families: ["paper-bag"] },
    expectNull: ["deadline"],
    expectMissingIds: ["deadline"],
  },
  {
    id: "irrelevant-enquiry",
    message: "Hello, what is your return policy for defects?",
    expectNull: ["quantity", "industry"],
    expectNoMatch: true,
  },
  {
    id: "budget-only",
    message: "What is the cheapest carry bag option for around 1000 pieces?",
    expect: { positioning: "economy", families: ["paper-bag"], quantity: 1000 },
  },

  // ---- coverage across industries, cities, languages ----
  {
    id: "menswear-city",
    message: "Running a menswear store in Madurai, want 300 vogue bags, premium finish, logo file in PDF",
    expect: {
      industry: "Menswear",
      city: "Madurai",
      quantity: 300,
      families: ["paper-bag"],
      positioning: "premium",
    },
    expectIndustryInTop5SimilarJobs: "Menswear",
  },
  {
    id: "cafe-two-products",
    message: "Cafe in Pondicherry — need 300 kraft mailers and 100 stickers for our packaging",
    expect: {
      industry: "Food (Non-direct / Cafe)",
      city: "Pondicherry",
      families: ["kraft-mailer", "sticker"],
    },
    expectMissingIds: ["size", "deadline"],
  },
  {
    id: "healthcare-clinic",
    message: "We are a dental clinic in Chennai, need 200 paper bags with our logo",
    expect: { industry: "Healthcare", city: "Chennai", quantity: 200, families: ["paper-bag"] },
    expectIndustryInTop5SimilarJobs: "Healthcare",
  },
  {
    id: "mobile-shop",
    message: "Mobile shop ku 1000 carry bags venum Coimbatore la",
    expect: { language: "tanglish", industry: "Mobile Shops", city: "Coimbatore", quantity: 1000 },
    expectFamilyInTop3: "paper-bag",
  },
  {
    id: "d2c-polymailer",
    message: "D2C skincare brand, launching soon. Need 500 black poly mailers — premium unboxing feel is important",
    expect: {
      industry: "D2C / E-commerce",
      quantity: 500,
      families: ["polymailer"],
      positioning: "premium",
    },
    expectIndustryInTop5SimilarJobs: "D2C / E-commerce",
  },
  {
    id: "saree-box-dimensions",
    message: "Need 100 saree boxes for wedding gifting, urgent — before Deepavali",
    expect: { quantity: 100, families: ["saree-box"] },
    expectNull: ["deadline"],
    expectMissingIds: ["dimensions", "deadline"],
  },
  {
    id: "concrete-date",
    message: "300 paper bags for my Erode textile shop, need by October 15",
    expect: { quantity: 300, city: "Erode", families: ["paper-bag"] },
    expectMissingIds: ["size", "colours"],
  },
  {
    id: "no-deadline-browsing",
    message: "Just exploring options for 300 paper bags, nothing urgent",
    expect: { quantity: 300, families: ["paper-bag"] },
    expectNull: ["deadline"],
  },
  {
    id: "kids-brand-file",
    message: "Hi! Kids clothing brand in Tirupur. 500 vogue bags please — logo attached as PDF.",
    expect: {
      industry: "Kids",
      city: "Tirupur",
      quantity: 500,
      families: ["paper-bag"],
    },
    expectIndustryInTop5SimilarJobs: "Kids",
  },
  {
    id: "mixed-language",
    message: "Vanakkam, எனக்கு 500 paper bags venum, Madurai boutique ku. Logo இருக்கு.",
    expect: { language: "mixed", quantity: 500, families: ["paper-bag"] },
  },
  {
    id: "supermarket-volume",
    message: "We are a supermarket chain, need 50000 paper bags, economy pricing, Chennai",
    expect: {
      quantity: 50000,
      city: "Chennai",
      positioning: "economy",
      families: ["paper-bag"],
    },
    expectFamilyInTop3: "paper-bag",
  },
  {
    id: "tissue-paper",
    message: "Need 500 tissue wrapping sheets for my saree boutique in Mysore, 1 colour",
    expect: { quantity: 500, city: "Mysore", families: ["stationery"], colours: 1 },
    expectIndustryInTop5SimilarJobs: "Saree Boutique",
  },
  {
    id: "business-cards",
    message: "100 business cards for my new beauty studio in Coimbatore, premium feel",
    expect: { quantity: 100, families: ["businesscard"], city: "Coimbatore", positioning: "premium" },
  },
  {
    id: "written-words-quantity",
    message: "Hi, need five hundred paper bags for our new saree store in Salem",
    expect: { quantity: 500, city: "Salem", families: ["paper-bag"] },
  },
];
