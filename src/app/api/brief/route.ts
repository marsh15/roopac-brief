import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";
import { ExtractionError } from "@/lib/ai/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE = 4000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_json", message: "Body must be JSON." } }, { status: 400 });
  }
  const { message, artwork } = (body ?? {}) as { message?: unknown; artwork?: unknown };

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "empty_message", message: "`message` is required and must be non-empty." } },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: { code: "message_too_long", message: `\`message\` must be ≤ ${MAX_MESSAGE} characters.` } },
      { status: 400 },
    );
  }
  if (artwork !== undefined && artwork !== null && typeof artwork !== "object") {
    return NextResponse.json(
      { error: { code: "bad_artwork", message: "`artwork` must be an object when present." } },
      { status: 400 },
    );
  }

  try {
    const result = await runPipeline(message);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ExtractionError) {
      const status = err.code === "missing_key" ? 500 : 502;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    console.error("pipeline failed:", err);
    return NextResponse.json(
      { error: { code: "pipeline_failed", message: "The brief pipeline failed unexpectedly." } },
      { status: 500 },
    );
  }
}
