import { NextResponse } from "next/server";
import { draftReply } from "@/lib/pipeline/reply";
import { getProducts } from "@/lib/data/loaders";
import type { PipelineResult } from "@/lib/pipeline/run";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * WhatsApp reply draft. Receives the full /api/brief pipeline result and
 * generates a reply grounded in it. Output is a DRAFT — the UI labels it for
 * human review before sending.
 */
export async function POST(req: Request) {
  let body: { pipeline?: PipelineResult };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_json", message: "Body must be JSON." } }, { status: 400 });
  }
  if (!body.pipeline || !Array.isArray(body.pipeline.recommendations) || !body.pipeline.extract) {
    return NextResponse.json(
      { error: { code: "bad_pipeline", message: "`pipeline` (the /api/brief response) is required." } },
      { status: 400 },
    );
  }

  try {
    const products = await getProducts();
    const draft = await draftReply(body.pipeline, products.map((p) => p.name));
    return NextResponse.json({ draft });
  } catch (err: any) {
    if (err?.code === "missing_key") {
      return NextResponse.json({ error: { code: "missing_key", message: err.message } }, { status: 500 });
    }
    console.error("reply draft failed:", err);
    return NextResponse.json(
      { error: { code: "draft_failed", message: "The reply draft failed; the brief itself is unaffected." } },
      { status: 502 },
    );
  }
}
