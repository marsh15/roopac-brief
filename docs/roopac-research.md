# Roopac public-site research, verified 2026-09-19

Evidence base for the Roopac Brief prototype. Every claim below was fetched live and verified with the cited URL. This file is the durable source the build tasks reference.

## 1. Scale and structure

- Sitemap: https://roopac.com/sitemap.xml (valid XML). 547 URLs total:
  - **64 product pages** (`/products/*`)
  - **427 portfolio records** (`/portfolio/*`), "The ROOPAC Record · 427 shops on file"
  - 14 family pages (`/families/*`, e.g. `/families/paper-bag`)
  - 16 industry pages (`/industries/*`)
  - ~26 static pages (`/about`, `/faq`, `/shipping`, `/careers`, `/portfolio`, `/samples`, …)
- Industry doorway counts (on `/portfolio`): Menswear 106, Women's Tailoring 84, Saree Boutique 34, Kids 30, Mobile Shops 21, Cosmetics & Accessories 17, Food 15, D2C/E-commerce 15, Jewelry 11, Healthcare 10, Gifting & Events 9, Footwear 7.

## 2. Product pages — identical structured spec block on every page checked

Fields: Material / Thickness-GSM / Available Sizes / Print Method / MOQ / Lead Time / Waterproof / Eco Friendly / Food Safe / Reusable, plus an "Order turnaround" selector (Value/Priority) and trust badges.

Verified examples:

| Product | URL | Material | GSM | Sizes | Print | MOQ | Lead |
|---|---|---|---|---|---|---|---|
| Classic on Butterfly | /products/classic-on-butterfly | High BF White Kraft Paper | 150 | 10x14x4 | Offset (up to 4 colours) | 300 | 3 weeks |
| Vogue on RedBull | /products/vogue-on-redbull | High Strength FBB Paper Board | 230 | 16x13x5 | Offset (up to 4 colours) | 300 | 3 weeks |
| Kraft Mailer | /products/kraft-mailer | Brown Kraft paper | 90 | 8x10 … 16x20 | Screen (up to 2 colours) | 100 | 3 weeks |
| Black Poly Mailer | /products/black-poly-mailer | 3-layer co-extruded LLDP/LDPE | 51 microns | 8x10 … 16x20 | Screen (up to 2 colours) | 100 | — |
| Tissue Wrapping Paper | /products/tissue-paper | — | 40 | 17.5x24 | Offset (up to 2 colours) | 500 | 2 weeks |
| Woven Labels | /products/woven-labels | Polyester Woven Fabric | Damask | — | Needle Loom Weaving (up to 3 colours) | 2000 | 2 weeks |
| Flat Tags | /products/flat-tags | Premium Art Board | 300 | 2x3.5" | Offset (up to 4 colours) | 1000 | 2 weeks |
| Business Card Signature | /products/business-card-signature | — | 400 | — | Offset (up to 4 colours) | 100 | 2 weeks |

- Product families seen in sitemap: paper bags (12 SKUs: {Classic,Sprout,Vogue} × {Butterfly,Firefly,RedBull,Rhino}), poly mailers (6 colours), kraft mailers (+ Signature, Misty Bag), boxes (tuck-end monocarton, RSC corrugated, rigid lid-and-bottom, collapsible magnetic, saree box, gable), labels/tags/cards (woven, cotton, size labels, flat tags, saree tag, business cards ×2, thanks card, tissue paper, diecut stickers).
- **No static prices** anywhere: pricing is a client-side configurator; JSON-LD `AggregateOffer` has no price. Our tool therefore validates MOQ, never prices.

## 3. Portfolio — full dataset embedded as JSON

- The RSC payload of https://roopac.com/portfolio contains **424 parsed record objects** (427 incl. cover story), schema:
  `slug, brandName, category, city, year, shortDescription, description, tagline, caseNumber, productsUsed[{href, name, type, hotspots[]}], heroImage, images[], video_url, outcomeStat, outcomeLabel, clientQuote, clientQuoteBy, pinned`
- Field coverage: category/productsUsed/description 100%; city 343/424; year 50/424; clientQuote and outcomeStat only 1 record (Kee & You).
- Verified records:
  - **Maya Mantra** (/portfolio/maya-mantra): Case Study Nº 05, Women's Tailoring, Tirupur, 7 products: Business Card Signature, Black Poly Mailer, Classic on Butterfly, Woven Labels, Round Stickers, Vogue on RedBull, Vogue on Butterfly.
  - **Kee & You** (/portfolio/kee-and-you): Nº 09, Women's Tailoring, Mysore, 3 products: Classic on RedBull, Black Poly Mailer, Tissue Wrapping Paper. "Reordered 4× — and counting / Six months in". Testimonial from Keerthi, Founder.
  - **BeeLittle** (/portfolio/beelittle): Nº 01, Kids, Tirupur, 3 products: Gable Monocarton Box, Tuck End Monocarton Box, Kraft Mailer.

## 4. Confirmed inconsistencies (the Catalogue Health evidence)

### Print-method contradiction (headline)
On https://roopac.com/products/classic-on-butterfly (same page, same render):
- Spec table: "Print Method: **Offset (up to 4 colours)**"
- Process copy ("HOW IT GOES", step 03 "We print & QC"): "**Flexo print, double-pass inspection.** No duds leave the floor."

Same pattern on /products/vogue-on-redbull. On /products/kraft-mailer the spec says **Screen** while the same boilerplate still says **Flexo**: the "Flexo" step text is pasted on every product page regardless of stated spec. Offset vs flexo vs screen are materially different production processes.

### Turnaround/SLA four-way conflict
- Homepage: "Once approved, your order is printed, quality-checked, and delivered to your doorstep in **about 3 weeks**." (Also: "We send a digital proof within 48 hours.")
- Shipping page (/shipping): "Most orders are delivered within **3 weeks** of artwork approval — that includes production (**1-2 weeks** depending on product) and shipping (**5-7 business days**). Simple products like stickers and business cards ship in about 1 week." Standard 5-7 business days, Express 2-3.
- Product pages (e.g. classic-on-butterfly, vogue-on-redbull, kraft-mailer, black-poly-mailer), all on one URL:
  - Spec table: "Lead Time: **3 weeks**"
  - Turnaround selector: "Value: **21 days production**" / "Priority: **7 days production**". "**Shipping time is separate** and calculated at checkout."
  - Trust badge: "Pan-India delivery **14 working days.**"
  - Process block: "HOW IT GOES", then "**Four steps. Fourteen days.** Zero surprises." / step 04, "It lands at your door": "**14 working days, tracked.**"
- FAQ (/faq): "Most products are delivered within **3 weeks** of artwork approval."

These cannot all be simultaneously true: "21 days production + separate shipping" (≈4+ weeks total) vs "14 working days total" vs "about 3 weeks total" vs "production 1-2 weeks + 5-7 days shipping".

## 5. Artwork rules (from /faq)

On "What artwork files do you accept?": **"AI, PDF, PSD, EPS, or high-resolution PNG/JPG (300 DPI minimum). You can also share a Canva link or Google Drive link — we'll convert it to print-ready format at no extra cost."**

MOQ tiers from same FAQ: "Rigid boxes start at 50 pieces. Cotton bags, polymailers, and kraft mailers start at 100. Paper bags and stationery from 300-500. Labels from 1,000."

## 6. Their tech stack (signals)

Custom Next.js (App Router + Turbopack chunks under /_next/static), Clerk auth, Razorpay checkout, Cloudflare + R2 media. No public REST API (`/api/*` 404s). All data server-rendered in HTML/RSC payload + JSON-LD (Product, FAQPage, BreadcrumbList, Organization). Family pages render per-SKU comparison matrices.

## 7. Known soft spots (design around these)

- Prices: not snapshot-able (client-side configurator).
- Reorder/testimonial data: effectively only Kee & You.
- `year` sparse (50/424), `city` sparse-ish (343/424).
- Portfolio "category" values are the industry names; match against the 16 industries list.

## 8. Feasibility verdict

Both snapshots buildable from public pages alone: products via sitemap crawl + spec-block parsing; portfolio via one fetch of /portfolio + tolerant JSON extraction from the RSC payload. SLA and print-method contradictions are real, live, quotable verbatim with stable URLs.
