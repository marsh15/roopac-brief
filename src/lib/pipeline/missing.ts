/**
 * Missing-information checklist: declarative rules per product family,
 * intersected with what the extract actually contains. Only genuinely
 * absent items are listed. Evals (Task 8) import the same table.
 */

export interface MissingItem {
  id: string;
  label: string;
}

/** family slug → required fields. "any" applies when no family matched. */
export const requiredFieldsByFamily: Record<string, { id: string; label: string }[]> = {
  "paper-bag": [
    { id: "size", label: "Exact bag size (W × H × Gusset, in inches)" },
    { id: "colours", label: "Number of print colours" },
    { id: "artwork", label: "Artwork file (AI/PDF/PSD/EPS or 300-DPI PNG/JPG — Canva/Drive link works too)" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  "kraft-mailer": [
    { id: "size", label: "Exact mailer size" },
    { id: "colours", label: "Number of print colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  polymailer: [
    { id: "size", label: "Exact mailer size" },
    { id: "colours", label: "Print coverage / colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  "cotton-bag": [
    { id: "size", label: "Exact bag size" },
    { id: "colours", label: "Number of print colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  corrugated: [
    { id: "dimensions", label: "Box internal dimensions (L × W × H, mm)" },
    { id: "board", label: "Board spec / contents weight (or we'll recommend one)" },
    { id: "colours", label: "Number of print colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  monocarton: [
    { id: "dimensions", label: "Box internal dimensions (L × W × H, mm)" },
    { id: "board", label: "Product dimensions + weight (to size the board)" },
    { id: "colours", label: "Number of print colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  rigid: [
    { id: "dimensions", label: "Box internal dimensions (L × W × H, mm)" },
    { id: "board", label: "Product dimensions + weight (to size the board)" },
    { id: "colours", label: "Number of print colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  "saree-box": [
    { id: "dimensions", label: "Box dimensions (or the saree fold size)" },
    { id: "colours", label: "Number of print colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  sticker: [
    { id: "size", label: "Sticker size and shape (or dieline)" },
    { id: "colours", label: "Full colour or spot colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  "fabric-label": [
    { id: "size", label: "Label size and fold type" },
    { id: "colours", label: "Number of weave colours" },
    { id: "artwork", label: "Artwork file (vector preferred)" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  "paper-tag": [
    { id: "size", label: "Tag size and hole/cord detail" },
    { id: "colours", label: "Number of print colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  businesscard: [
    { id: "size", label: "Card size (standard 3.5×2 in?)" },
    { id: "colours", label: "Front/back, number of colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  stationery: [
    { id: "size", label: "Size (A4? custom?)" },
    { id: "colours", label: "Number of print colours" },
    { id: "artwork", label: "Artwork file or Canva/Drive link" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  "protective-bag": [
    { id: "size", label: "Item dimensions to protect" },
    { id: "colours", label: "Print needed?" },
    { id: "artwork", label: "Artwork file (if printed)" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
  essentials: [
    { id: "size", label: "Size needed" },
    { id: "colours", label: "Print colours (if printed)" },
    { id: "artwork", label: "Artwork file (if printed)" },
    { id: "deadline", label: "Confirmed required-by date" },
  ],
};

const DEFAULT_RULES = [
  { id: "family", label: "Which product do you need? (bags / boxes / mailers / labels…)" },
  { id: "quantity", label: "How many pieces?" },
  { id: "deadline", label: "Confirmed required-by date" },
];

/** Extract fields computeMissing reads. Deliberately narrower than EnquiryExtract. */
export interface ExtractForMissing {
  families: string[];
  quantity: number | null;
  colours: number | null;
  sizes: string[];
  artwork: { mentioned: boolean; kinds?: string[]; note?: string | null };
  deadline: string | null;
  deadlineText: string | null;
}

/** The board-spec ask collapses to `board` ids; size/dimensions share the `size` slot for boxes. */
export function computeMissing(extract: ExtractForMissing): MissingItem[] {
  const families = extract.families.length
    ? extract.families
    : ["__any__"];
  const rules = new Map<string, MissingItem>();
  for (const family of families) {
    const familyRules =
      family === "__any__"
        ? DEFAULT_RULES
        : (requiredFieldsByFamily[family] ?? DEFAULT_RULES);
    for (const rule of familyRules) {
      if (!rules.has(rule.id)) rules.set(rule.id, rule);
    }
  }
  // quantity is universally required — family rule sets assume it
  if (!rules.has("quantity")) rules.set("quantity", { id: "quantity", label: "How many pieces?" });

  const satisfied = new Set<string>();
  if (extract.quantity !== null) satisfied.add("quantity");
  if (extract.colours !== null) satisfied.add("colours");
  if (extract.sizes.length > 0) {
    satisfied.add("size");
    satisfied.add("dimensions");
  }
  if (extract.artwork.mentioned) satisfied.add("artwork");
  // a concrete date satisfies "deadline"; vague wording ("next month") does not —
  // it keeps the item but the brief adds a reality check instead
  if (extract.deadline) satisfied.add("deadline");
  if (extract.families.length) satisfied.add("family");

  const missing: MissingItem[] = [];
  for (const rule of rules.values()) {
    if (!satisfied.has(rule.id)) missing.push(rule);
  }
  // ambiguous deadline wording ("next month") always demands a confirmed date,
  // whether or not the family rule already listed one
  if (extract.deadlineText && !extract.deadline) {
    const item = missing.find((m) => m.id === "deadline");
    if (item) item.label = "Confirm exact required-by date";
    else missing.push({ id: "deadline", label: "Confirm exact required-by date" });
  }
  return missing;
}
