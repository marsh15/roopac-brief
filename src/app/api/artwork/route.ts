import { NextResponse } from "next/server";
import { triageLink, triageUpload } from "@/lib/artwork";

/**
 * POST /api/artwork — artwork triage.
 *
 * Accepts either:
 *  - multipart/form-data with a `file` field (≤ 10 MB), or
 *  - application/json with a `{ url }` body (Canva / Google Drive link).
 *
 * Files are inspected in-memory only — nothing is written to disk.
 * Success: 200 `{ triage }`. Errors: `{ error: { code, message } }`.
 */

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

type ApiErrorCode =
  | "missing_file_or_url"
  | "invalid_json"
  | "file_too_large"
  | "unsupported_content_type";

function errorResponse(code: ApiErrorCode, message: string, status: 400 | 413 | 415): Response {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_json", "Request body is not valid JSON.", 400);
    }
    const url =
      typeof body === "object" && body !== null ? (body as { url?: unknown }).url : undefined;
    if (typeof url !== "string" || url.trim() === "") {
      return errorResponse("missing_file_or_url", "Send JSON { url } with the Canva or Google Drive link.", 400);
    }
    return NextResponse.json({ triage: triageLink(url) });
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return errorResponse("missing_file_or_url", "Send multipart/form-data with a `file` field.", 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      return errorResponse(
        "file_too_large",
        `File is ${file.size} bytes; the limit is ${MAX_FILE_BYTES} bytes (10 MB).`,
        413,
      );
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    return NextResponse.json({ triage: triageUpload(file.name, buffer) });
  }

  return errorResponse(
    "unsupported_content_type",
    "Send multipart/form-data (file upload) or application/json ({ url }).",
    415,
  );
}
