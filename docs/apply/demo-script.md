# 90-second demo script — Roopac Brief

Tone: calm, concrete. Show, don't pitch. Every claim on screen is backed by a link or a number.

---

**[0:00–0:10] Hook — the problem**

> "A Roopac sales enquiry arrives on WhatsApp — half English, half Tamil, no sizes, no artwork, 'next month' as a deadline. Today someone re-types it, guesses products from memory, and walks back to the customer with questions. This tool turns that message into a grounded internal brief in one step."

*(Paste the Tanglish sample enquiry into the builder.)*

**[0:10–0:25] The pipeline runs**

> "One API call. The model does exactly one thing here — extract what the customer actually said, in Tanglish, without inventing anything. Everything after that is deterministic code over a committed snapshot of roopac.com: 64 products, 427 portfolio records, every spec with its source URL."

*(Point at the "Understood" section, then the recommended-product card.)*

**[0:25–0:40] Grounded recommendations**

> "Recommendations cite real specs — 230 GSM FBB, MOQ 300 against the customer's 500, each line linkable to the product page. Below-MOQ quantities become flags, not silent drops. And when someone asks for coffee mugs, it says 'no catalogue match' instead of inventing a product."

**[0:40–0:55] The brief + WhatsApp draft**

> "Still-required items replace the usual interrogation — only what's genuinely missing. The internal brief is plain text, printable, copy-ready. And the customer reply is a draft — grounded strictly in the recommendation set, in the customer's own language style, explicitly marked for human review before sending."

*(Copy the WhatsApp draft.)*

**[0:55–1:10] Catalogue Health — proof of inspection**

> "While snapshotting the catalogue, the auditor found contradictions live on roopac.com: the spec table says Offset while the process copy on the same page says Flexo. And four different delivery promises — 21 days production, 14 working days total, about 3 weeks total, and production 1–2 weeks plus 5–7 days shipping — which can't all be true."

*(Open /health, scroll the SLA finding with its quotes and URLs.)*

**[1:10–1:25] Evals — measured, not vibes**

> "27 test enquiries — English, Tamil, Tanglish, edge cases. Field-level extraction accuracy, missing-field detection, MOQ-violation detection, and a hallucinated-product rate that must stay at zero — asserted in CI-style via `npm run eval:assert`. Known failure modes are documented in the README."

*(Open /evals, point at the metric tiles.)*

**[1:25–1:30] Close**

> "The LLM touches three places — extraction, artwork intent, reply draft. Everything a customer could rely on is deterministic, cited, and tested. Links to the live demo, the repo, and the eval numbers are in the README."

---

## Recording notes

- 1440p, browser at 100%, warm-paper page fills the frame; terminal only for `npm run eval:assert`.
- Pre-run the three samples once before recording so responses are warm.
- If the live API is slow during recording, cut the wait with a jump-cut at 0:10 — never fake progress.
