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

<!-- EVALS: paste the metrics table from evals/results.json after npm run eval -->

## Known failure modes

<!-- FAILURES: documented after the eval run -->

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

## Attribution

Independent prototype built for a job application, using only roopac.com's public pages (fetched politely,
once, with source URLs preserved throughout). Not affiliated with ROOPAC; all trademarks belong to their
owners. Will be removed promptly on request.

## Built AI-first

<!-- AI-FIRST: filled in Task 9 -->
