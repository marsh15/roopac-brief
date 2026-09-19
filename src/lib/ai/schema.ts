import { z } from "zod";
import { INDUSTRIES } from "../data/schemas";

/**
 * EnquiryExtract — the contract owned by extraction and consumed by matching
 * (Task 3), the pipeline (Task 4), the UI (Task 6) and evals (Task 8).
 * Every field is nullable: information the customer never stated stays null.
 */

export const artworkKinds = ["file", "canva_link", "drive_link", "physical_sample", "other"] as const;

export function makeEnquiryExtractSchema(familySlugs: readonly string[]) {
  return z.object({
    language: z
      .enum(["english", "tamil", "tanglish", "mixed"])
      .describe(
        "Language of the message. Tamil words written in LATIN script ('venum', 'iruku', 'enaku', 'ku') with NO Tamil-script characters = tanglish (even if it feels like Tamil). Tamil-script characters (தமிழ்) with no other language = tamil. Tamil script mixed with English/Latin words = mixed. Plain English = english.",
      ),
    industry: z
      .enum(INDUSTRIES)
      .nullable()
      .describe(
        "Customer's business type, normalized to Roopac's industry names. Glosses: bakery/cafe/restaurant/food brand/sweets = 'Food (Non-direct / Cafe)'; online-only brand = 'D2C / E-commerce'; saree shop = 'Saree Boutique'; tailoring/churidars/boutique garments = 'Women's Tailoring' or 'Menswear'; phone accessories shop = 'Mobile Shops'; clinic/hospital = 'Healthcare'. null if nothing fits, keeping their wording in industryRaw.",
      ),
    industryRaw: z.string().nullable().describe("Verbatim industry/business wording if it didn't map cleanly."),
    city: z.string().nullable().describe("City the customer is in. null if not stated."),
    quantity: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Number of pieces requested, as a number. Written-out numbers ('five hundred') become digits."),
    families: z
      .array(z.enum(familySlugs as [string, ...string[]]))
      .max(5)
      .describe(
        "Product families the customer wants, from the enum. Glosses: paper-bag = printed paper carry bags; kraft-mailer = brown kraft paper mailers; polymailer = plastic poly/courier mailers; corrugated/monocarton/rigid/saree-box = boxes; sticker = diecut stickers/vinyl labels; fabric-label = woven/cotton/size clothing labels; paper-tag = swing/paper tags; businesscard = business cards; stationery = tissue wrapping paper, thank-you cards, letterheads; cotton-bag = cloth/cotton bags; protective-bag = protective packaging; essentials = satin rolls, shredded paper, gift wrap, sleeves. Empty array if unclear.",
      ),
    familiesRaw: z
      .array(z.string())
      .describe("Verbatim product wording from the message ('paper bags', 'cover maathi')."),
    sizes: z
      .array(z.string())
      .describe("Sizes as stated, verbatim ('10x14x4', 'A4'). Empty if none given."),
    usage: z.string().nullable().describe("What the packaging is for, if stated (e.g. 'saree packing')."),
    positioning: z
      .enum(["premium", "balanced", "economy"])
      .nullable()
      .describe("Quality tier the customer implies. null if not evident."),
    colours: z
      .number()
      .int()
      .min(0)
      .max(6)
      .nullable()
      .describe("Number of print colours wanted. null if not stated."),
    deadline: z
      .string()
      .nullable()
      .describe("Required-by date as ISO date ONLY if a concrete date is derivable (e.g. 'by March 5'). Otherwise null."),
    deadlineText: z
      .string()
      .nullable()
      .describe("Verbatim deadline wording whenever any time pressure is mentioned ('next month', 'urgent', 'before Deepavali'). null if none."),
    artwork: z.object({
      mentioned: z.boolean().describe("True if the customer mentioned any artwork/logo/design asset."),
      kinds: z.array(z.enum(artworkKinds)).describe("Kinds of artwork mentioned. Empty if none."),
      note: z.string().nullable().describe("Verbatim artwork detail ('logo iruku', 'Canva link share panren')."),
    }),
    notes: z.string().nullable().describe("Anything else relevant a salesperson should know. null if nothing."),
  });
}

export type EnquiryExtract = z.infer<ReturnType<typeof makeEnquiryExtractSchema>>;

export const emptyExtract: EnquiryExtract = {
  language: "english",
  industry: null,
  industryRaw: null,
  city: null,
  quantity: null,
  families: [],
  familiesRaw: [],
  sizes: [],
  usage: null,
  positioning: null,
  colours: null,
  deadline: null,
  deadlineText: null,
  artwork: { mentioned: false, kinds: [], note: null },
  notes: null,
};
