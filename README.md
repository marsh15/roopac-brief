# Roopac Brief

> Independent job-application prototype built from roopac.com's public site. Not affiliated with or endorsed by
> ROOPAC. All data is a committed snapshot of publicly available pages with source URLs preserved. Removed
> promptly on request.

**One messy WhatsApp enquiry in (English / Tamil / Tanglish) → one grounded internal job brief out** — with
evidence-backed product recommendations, similar past work, a missing-information checklist, artwork triage, and
a human-approved WhatsApp reply draft. Plus a Catalogue Health auditor that flags real contradictions in the
public product information, and an eval suite that measures the whole pipeline.

## Why this exists

Enquiries at a custom-printing shop arrive as one-line WhatsApp messages: *"Anna enaku 500 paper bag venum,
boutique ku, logo iruku"*. Turning that into a production-ready brief means: figure out what they want, check
it against the catalogue, recall similar jobs, ask only for what's genuinely missing, and reply in the
customer's own language — without quoting a price (Roopac's pricing is a client-side configurator, so this tool
validates MOQs and never invents numbers). Sales currently does all of that by hand. This prototype is the
handoff, automated.

## How it works

```
                    ┌──────────────────────────── the LLM touches exactly 3 places ───┐
                    │                                                                  │
enquiry text ──────►│ ① extractRequirements   ──►  EnquiryExtract (all-nullable)       │
artwork file/link   │      OpenAI structured output, temperature 0, retry once         │
                    │                                                                  │
                    │ ② artwork intent notes (inside the reply draft's grounding)      │
                    │                                                                  │
                    │ ③ draftReply — WhatsApp draft, grounded in the pipeline JSON,    │
                    │    post-checked: every product named must be in the rec set      │
                    └──────────────────────────────────────────────────────────────────┘
                                   │ deterministic code over the snapshot ↓
                    ┌──────────────┴────────────────────────────────────────────────────┐
                    │ matchProducts()      ranked recommendations, per-fact evidence,   │
                    │                      MOQ/colour violations as flags, no-match     │
                    │ similarJobs()        industry/city/family overlap over 427 jobs   │
                    │ computeMissing()     declarative required-fields table per family │
                    │ timelineCheck()      required date vs that product's lead time    │
                    │ renderBrief()        plain-text ROOPAC JOB BRIEF (traceable)      │
                    │ audit rules          print-method & turnaround contradiction scan │
                    └───────────────────────────────────────────────────────────────────┘
```

Grounding data is a committed snapshot (`data/*.json`), built once by `npm run snapshot` from roopac.com with
source URLs preserved per product and per portfolio record. No database. No fake match percentages — evidence
checklists only.

## The three surfaces

| Route | What it is |
|---|---|
| `/` | Brief builder — samples, artwork triage, evidence cards, checklist, brief, WhatsApp draft |
| `/health` | Catalogue Health — contradictions found in the public catalogue, with verbatim quotes + URLs |
| `/evals` | Eval run results — per-case assertions and headline metrics |

## Eval numbers

Run `npm run eval` (needs `OPENAI_API_KEY`, ~27 small-model calls) → `evals/results.json` + the `/evals` page;
`npm run eval:assert` gates regressions against `evals/baseline.json`.

The suite asserts, per case: field-level extraction accuracy (including no-invention checks on
must-be-null fields), missing-field detection against the same declarative table the app uses, recommendation
validity (every recommended product's URL must exist in the committed catalogue — hallucinated-product rate is
asserted to be 0, by construction and by check), MOQ-violation detection (below-MOQ cases must flag the exact
minimum), and similar-job relevance (expected industry in the top 5).

| Metric | Result |
|---|---|
| Cases | 27 (English / Tamil / Tanglish / mixed + edge cases) |
| Hallucinated products | asserted 0 every run |
| Extraction accuracy, missing-field detection, MOQ detection, similar-job relevance | fill from `evals/results.json` after your first `npm run eval` |

The first three cases are byte-identical to the three UI samples, so the demo can never silently diverge from
the evals.

## Known failure modes

Observed while building; both are extraction (the only model-touched stage that reads customer intent), both
are caught by the eval suite, and neither can produce a wrong product fact (matching is deterministic):

1. **Tanglish written-out quantities.** Quantity words in Latin script are the noisiest extraction field.
   Mitigation: quantities below a family's MOQ always surface as a flag, so a misheard quantity is visible,
   never silent. Accepted limitation: correction needs a follow-up message.
2. **"Premium" over-mapping.** A premium positioning mention can occasionally attach to an adjacent family
   the customer didn't name. Mitigation: the matcher's weight table makes family match dominate positioning
   (100 vs 10), so positioning alone can't put an unasked family in the top 3; the eval suite asserts this
   directly.

## Setup

```bash
npm i
cp .env.example .env          # set OPENAI_API_KEY (extraction + reply draft + evals)
npm run snapshot              # re-crawl roopac.com (cached, polite) — optional, data/ is committed
npm run verify-data           # assert snapshot integrity
npm run dev                   # the app
npm test                      # unit tests (no network)
npm run audit                 # regenerate data/findings.json (deterministic, no LLM)
npm run eval && npm run eval:assert   # live eval suite + regression gate
```

## Built AI-first

This project was built with an AI coding agent (ZCode) in a human-directed loop — the role this application
is for. What that looked like concretely:

**What AI accelerated**
- Scaffolding: Next.js app shell, Tailwind theme, shadcn-style components, configs — minutes, not hours.
- Schema drafts: the Zod snapshot schemas and the `EnquiryExtract` contract were drafted, then tightened by
  hand against real payload quirks (RSC's `"$undefined"` markers, string-typed years, sitewide boilerplate).
- Test generation: 89 unit tests, including in-test PNG/JPEG byte fabrication for the artwork DPI fixtures.
- Parallel execution: three independent modules (matching, artwork triage, catalogue auditor) were specified
  as contracts and built concurrently; integration fixes were reconciled in one pass.
- Mechanical plumbing: route handlers, copy buttons, page tables, the duration normalizer's case coverage.

**What was deliberately kept deterministic, and why**
- Product matching, MOQ checks, missing-field detection, brief rendering, contradiction auditing: these are
  the claims a customer (or an employer) can check. Pure functions over a committed snapshot, cited line by
  line. An LLM opinion here would be unverifiable — and quietly wrong at the worst moment.
- No match percentages: scoring exists for ranking only; users see evidence checklists, not fake precision.
- Prices: never generated (Roopac's pricing is client-side; the tool validates MOQs, never quotes).
- The WhatsApp draft is the one generative customer-facing artifact — so it's grounded strictly in pipeline
  JSON, post-checked against the recommendation set, retried once, and falls back to a deterministic template.
  And it's labelled a draft for human approval.

## Attribution

Independent prototype built for a job application, using only roopac.com's public pages (fetched politely,
once, with source URLs preserved throughout). Not affiliated with ROOPAC; all trademarks belong to their
owners. Will be removed promptly on request.

## Built AI-first

<!-- AI-FIRST: filled in Task 9 -->
