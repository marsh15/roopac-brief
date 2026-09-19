# Application email (~120 words)

<!-- Subject: Vibe Coder application: Roopac Brief (a working prototype, not a deck) -->

Hi [name],

For my application I built Roopac Brief: it turns one messy WhatsApp message, in English, Tamil, or Tanglish,
into a grounded internal job brief. Product recommendations cite real catalogue specs (MOQ checks included),
similar jobs come from your 427-record portfolio, the checklist asks for only what's genuinely missing, artwork
gets triaged, and the WhatsApp reply is a draft marked for human approval.

Two extras from inspecting your site: a Catalogue Health audit (your spec tables and process copy appear to
disagree on print method, and four delivery promises coexist; I flag them as review candidates with quotes and
URLs on /health, since you'd know the ground truth) and a 27-case eval suite with measured extraction accuracy
and a zero-hallucinated-products gate (/evals).

Live demo: [add Vercel URL after `vercel login` + `vercel --prod`] · Code: https://github.com/marsh15/roopac-brief

The LLM touches exactly three places; everything else is deterministic, cited code. Happy to walk through it.

[Your name]
