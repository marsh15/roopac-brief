import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  RULES_QUOTE,
  RULES_SOURCE_URL,
  triageLink,
  triageRasterImage,
  triageUpload,
  triageVectorFile,
  type ArtworkTriage,
} from "./artwork";
import { POST } from "../app/api/artwork/route";

// Pure, offline triage: PNG/JPEG fixtures are generated in-test from raw bytes.
// 96 DPI ≈ 3780 pixels per metre; 300 DPI ≈ 11811 ppm (ppm / 39.3701 = DPI).

const PPM_PER_INCH = 39.3701;
const PPM_96 = Math.round(96 * PPM_PER_INCH); // 3780
const PPM_300 = Math.round(300 * PPM_PER_INCH); // 11811

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function makePng(opts: {
  width: number;
  height: number;
  colorType?: 2 | 6; // 2 = truecolour, 6 = truecolour + alpha
  ppm?: number;
  withPhys?: boolean;
}): Uint8Array {
  const { width, height, colorType = 2, ppm = PPM_300, withPhys = true } = opts;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const raw = Buffer.alloc(height * (1 + width * bytesPerPixel)); // filter byte 0 + zero pixels
  const parts: Buffer[] = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
  ];
  if (withPhys) {
    const phys = Buffer.alloc(9);
    phys.writeUInt32BE(ppm, 0);
    phys.writeUInt32BE(ppm, 4);
    phys[8] = 1; // unit: metre
    parts.push(pngChunk("pHYs", phys));
  }
  parts.push(pngChunk("IDAT", zlib.deflateSync(raw)));
  parts.push(pngChunk("IEND", new Uint8Array(0)));
  return Buffer.concat(parts);
}

function makeJpeg(opts: { width: number; height: number; dpi?: number; units?: 0 | 1 | 2 }): Uint8Array {
  const { width, height, dpi = 300, units = 1 } = opts;
  const app0 = Buffer.alloc(18);
  app0[0] = 0xff;
  app0[1] = 0xe0;
  app0.writeUInt16BE(16, 2); // segment length (includes itself)
  app0.write("JFIF\0", 4, "ascii");
  app0[9] = 0x01; // version 1.1
  app0[10] = 0x01;
  app0[11] = units; // 0 = aspect only, 1 = DPI, 2 = dots per cm
  app0.writeUInt16BE(dpi, 12);
  app0.writeUInt16BE(dpi, 14);
  const sof0 = Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
  ]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0, sos, Buffer.from([0xff, 0xd9])]);
}

function checkOf(triage: ArtworkTriage, item: string) {
  const check = triage.checks.find((c) => c.item === item);
  expect(check, `expected a "${item}" check`).toBeDefined();
  return check!;
}

const API_URL = "http://localhost:3000/api/artwork";

async function postJson(body: unknown): Promise<Response> {
  return POST(
    new Request(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function postFile(filename: string, bytes: Uint8Array): Promise<Response> {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], filename, { type: "application/octet-stream" }));
  // No explicit content-type header: the Request constructor derives
  // multipart/form-data (with boundary) from the FormData body itself.
  return POST(new Request(API_URL, { method: "POST", body: form }));
}

describe("PNG raster triage (pHYs → DPI)", () => {
  it("blocks a 96 DPI PNG with the exact FAQ reason", () => {
    const result = triageRasterImage(makePng({ width: 40, height: 30, ppm: PPM_96 }), "logo-96.png");
    const resolution = checkOf(result, "resolution");
    expect(resolution.status).toBe("blocker");
    expect(resolution.detail).toContain("96 DPI");
    expect(resolution.detail).toContain("below 300 DPI minimum (Roopac FAQ)");
    expect(result.verdict).toBe("blocker");
    expect(result.kind).toBe("raster");
  });

  it("passes a 300 DPI PNG", () => {
    const result = triageRasterImage(makePng({ width: 40, height: 30, ppm: PPM_300 }), "logo-300.png");
    const resolution = checkOf(result, "resolution");
    expect(resolution.status).toBe("pass");
    expect(resolution.detail).toContain("300 DPI");
    expect(result.verdict).toBe("pass");
  });

  it("passes a transparent 300 DPI PNG and notes the transparency", () => {
    const result = triageRasterImage(
      makePng({ width: 40, height: 30, ppm: PPM_300, colorType: 6 }),
      "logo-transparent.png",
    );
    expect(checkOf(result, "resolution").status).toBe("pass");
    const transparency = checkOf(result, "transparency");
    expect(transparency.status).toBe("pass");
    expect(transparency.detail).toContain("transparency present");
    expect(result.verdict).toBe("pass");
  });

  it("flags a PNG with a tRNS chunk as transparent", () => {
    const base = Buffer.from(makePng({ width: 4, height: 2, ppm: PPM_300 }));
    // Insert a tRNS chunk after IHDR (IHDR is always the first chunk).
    const ihdrEnd = 8 + 12 + 13;
    const trns = pngChunk("tRNS", Buffer.alloc(2));
    const bytes = Buffer.concat([base.subarray(0, ihdrEnd), trns, base.subarray(ihdrEnd)]);
    const result = triageRasterImage(new Uint8Array(bytes), "logo-trns.png");
    expect(checkOf(result, "transparency").detail).toContain("tRNS");
  });

  it("reviews a PNG with no pHYs chunk (DPI unknown)", () => {
    const result = triageRasterImage(
      makePng({ width: 40, height: 30, withPhys: false }),
      "logo-nophys.png",
    );
    const resolution = checkOf(result, "resolution");
    expect(resolution.status).toBe("review");
    expect(resolution.detail).toContain("DPI");
    expect(result.verdict).toBe("review");
  });

  it("reports dimensions and aspect ratio without judgment", () => {
    const result = triageRasterImage(makePng({ width: 40, height: 30, ppm: PPM_300 }), "logo.png");
    expect(checkOf(result, "dimensions").detail).toContain("40 × 30 px");
    expect(checkOf(result, "aspect-ratio").detail).toContain("4:3");
    expect(checkOf(result, "aspect-ratio").status).toBe("pass");
  });

  it("blocks a raster call on bytes that are neither PNG nor JPEG", () => {
    const result = triageRasterImage(new Uint8Array([1, 2, 3, 4]), "mystery.png");
    expect(result.checks.some((c) => c.status === "blocker")).toBe(true);
    expect(result.verdict).toBe("blocker");
  });
});

describe("JPEG raster triage (JFIF APP0 → DPI)", () => {
  it("passes a 300 DPI JPEG via JFIF density", () => {
    const result = triageRasterImage(makeJpeg({ width: 40, height: 30, dpi: 300 }), "photo.jpg");
    expect(checkOf(result, "resolution").status).toBe("pass");
    expect(checkOf(result, "resolution").detail).toContain("300 DPI");
    expect(result.verdict).toBe("pass");
  });

  it("blocks a 96 DPI JPEG", () => {
    const result = triageRasterImage(makeJpeg({ width: 40, height: 30, dpi: 96 }), "photo-96.jpg");
    expect(checkOf(result, "resolution").detail).toContain("below 300 DPI minimum (Roopac FAQ)");
  });

  it("reviews a JPEG whose JFIF header has no density unit, and notes no transparency", () => {
    const result = triageRasterImage(
      makeJpeg({ width: 40, height: 30, units: 0, dpi: 1 }),
      "photo-aspect-only.jpg",
    );
    expect(checkOf(result, "resolution").status).toBe("review");
    expect(checkOf(result, "transparency").detail).toContain("no transparency");
  });
});

describe("vector / source files", () => {
  it("reviews a PDF for designer conversion, with a pass check for format acceptance", () => {
    const result = triageVectorFile("catalogue.pdf");
    expect(result.kind).toBe("vector-or-source");
    const conversion = checkOf(result, "print-conversion");
    expect(conversion.status).toBe("review");
    expect(conversion.detail).toContain("vector/probational format — designer converts to print-ready");
    expect(checkOf(result, "format").status).toBe("pass");
    expect(result.verdict).toBe("review");
  });

  it("treats AI, EPS and PSD the same way", () => {
    for (const filename of ["logo.ai", "art.eps", "master.psd"]) {
      const result = triageVectorFile(filename);
      expect(result.kind).toBe("vector-or-source");
      expect(result.verdict).toBe("review");
    }
  });
});

describe("link triage", () => {
  it("reviews a canva.com link", () => {
    const result = triageLink("https://www.canva.com/design/DAF123/view");
    expect(result.source).toBe("link");
    expect(result.kind).toBe("link");
    expect(result.filename).toBeNull();
    expect(checkOf(result, "link-source").status).toBe("review");
    expect(checkOf(result, "link-source").detail).toContain("free conversion");
    expect(result.verdict).toBe("review");
  });

  it("reviews Google Drive and Docs links, case-insensitively", () => {
    expect(triageLink("https://drive.google.com/file/d/abc/view").verdict).toBe("review");
    expect(triageLink("https://docs.google.com/document/d/xyz/edit").verdict).toBe("review");
    expect(triageLink("https://WWW.Canva.COM/design/x").verdict).toBe("review");
  });

  it("blocks links to other domains", () => {
    const result = triageLink("https://dribbble.com/shots/123");
    expect(checkOf(result, "link-source").status).toBe("blocker");
    expect(checkOf(result, "link-source").detail).toContain(
      "link must be Canva or Google Drive (Roopac FAQ)",
    );
    expect(result.verdict).toBe("blocker");
  });

  it("blocks an unparseable link", () => {
    const result = triageLink("not a url");
    expect(result.verdict).toBe("blocker");
  });
});

describe("upload dispatch", () => {
  it("routes png/jpg by extension to raster triage", () => {
    const png = makePng({ width: 40, height: 30, ppm: PPM_300 });
    expect(triageUpload("art.PNG", png).kind).toBe("raster");
    expect(triageUpload("art.JPEG", makeJpeg({ width: 40, height: 30 })).kind).toBe("raster");
  });

  it("blocks unknown extensions with the accepted-format list", () => {
    const result = triageUpload("logo.fig", new Uint8Array([0, 1, 2]));
    expect(result.kind).toBe("unknown");
    const format = checkOf(result, "format");
    expect(format.status).toBe("blocker");
    expect(format.detail).toContain("accepted: AI, PDF, PSD, EPS, PNG, JPG (or a Canva/Drive link)");
    expect(result.verdict).toBe("blocker");
  });
});

describe("verdict aggregation", () => {
  it("blocker dominates pass checks", () => {
    // dimensions pass + transparency pass + resolution blocker → verdict blocker
    const result = triageRasterImage(makePng({ width: 40, height: 30, ppm: PPM_96 }), "logo.png");
    expect(result.checks.some((c) => c.status === "pass")).toBe(true);
    expect(result.checks.some((c) => c.status === "blocker")).toBe(true);
    expect(result.verdict).toBe("blocker");
  });

  it("review wins over pass when there are no blockers", () => {
    const result = triageRasterImage(
      makePng({ width: 40, height: 30, withPhys: false }),
      "logo.png",
    );
    expect(result.checks.every((c) => c.status !== "blocker")).toBe(true);
    expect(result.verdict).toBe("review");
  });

  it("is pass only when every check passes", () => {
    const result = triageRasterImage(
      makePng({ width: 40, height: 30, ppm: PPM_300, colorType: 6 }),
      "logo.png",
    );
    expect(result.checks.every((c) => c.status === "pass")).toBe(true);
    expect(result.verdict).toBe("pass");
  });
});

describe("FAQ sourcing", () => {
  const results: ArtworkTriage[] = [
    triageRasterImage(makePng({ width: 40, height: 30, ppm: PPM_96 }), "a.png"),
    triageRasterImage(makePng({ width: 40, height: 30, ppm: PPM_300 }), "b.png"),
    triageRasterImage(makePng({ width: 40, height: 30, withPhys: false }), "c.png"),
    triageRasterImage(makeJpeg({ width: 40, height: 30 }), "d.jpg"),
    triageVectorFile("e.pdf"),
    triageLink("https://www.canva.com/design/x"),
    triageLink("https://example.com/not-accepted"),
    triageUpload("f.zip", new Uint8Array([0])),
  ];

  it("attaches the FAQ quote and source URL to every triage result", () => {
    for (const result of results) {
      expect(result.rulesQuote).toBe(RULES_QUOTE);
      expect(result.rulesSourceUrl).toBe(RULES_SOURCE_URL);
      expect(result.rulesSourceUrl).toBe("https://roopac.com/faq");
    }
  });

  it("quotes the FAQ wording verbatim from the /faq page snapshot", () => {
    const pages = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "data", "pages.json"), "utf8"),
    ) as { pages: Array<{ url: string; segments: string[] }> };
    const faq = pages.pages.find((p) => p.url === "https://roopac.com/faq");
    expect(faq).toBeDefined();
    expect(faq!.segments).toContain(RULES_QUOTE);
  });
});

describe("POST /api/artwork", () => {
  it("triages a multipart upload in-memory", async () => {
    const res = await postFile("art.png", makePng({ width: 40, height: 30, ppm: PPM_300 }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { triage: ArtworkTriage };
    expect(body.triage.kind).toBe("raster");
    expect(body.triage.filename).toBe("art.png");
    expect(body.triage.verdict).toBe("pass");
  });

  it("triages a JSON { url } body", async () => {
    const res = await postJson({ url: "https://drive.google.com/file/d/abc/view" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { triage: ArtworkTriage };
    expect(body.triage.source).toBe("link");
    expect(body.triage.verdict).toBe("review");
  });

  it("returns a typed 413 for files over 10 MB", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    const res = await postFile("big.png", big);
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("file_too_large");
  });

  it("returns a typed 400 when neither file nor url is present", async () => {
    const res = await postJson({});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("missing_file_or_url");

    const emptyForm = new FormData();
    const formRes = await POST(new Request(API_URL, { method: "POST", body: emptyForm }));
    expect(formRes.status).toBe(400);
  });

  it("returns a typed 415 for unsupported content types", async () => {
    const res = await POST(
      new Request(API_URL, { method: "POST", headers: { "content-type": "text/plain" }, body: "hello" }),
    );
    expect(res.status).toBe(415);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unsupported_content_type");
  });
});
