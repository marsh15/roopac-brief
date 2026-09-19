import { imageSize } from "image-size";

/**
 * Artwork triage: deterministic, rule-based checks against Roopac's published
 * artwork rules (docs/roopac-research.md §5, snapshot of https://roopac.com/faq).
 * No LLM, no vision model, no scoring — every check is a pass/review/blocker
 * with a human-readable reason, sourced from the FAQ wording below.
 */

export const RULES_QUOTE =
  "AI, PDF, PSD, EPS, or high-resolution PNG/JPG (300 DPI minimum). You can also share a Canva link or Google Drive link — we'll convert it to print-ready format at no extra cost.";

export const RULES_SOURCE_URL = "https://roopac.com/faq";

const MIN_DPI = 300;
const PPM_PER_INCH = 39.3701; // 1 inch = 0.0254 m → DPI = ppm / 39.3701

const ACCEPTED_FORMATS_DETAIL =
  "accepted: AI, PDF, PSD, EPS, PNG, JPG (or a Canva/Drive link)";

const VECTOR_CONVERSION_DETAIL =
  "vector/probational format — designer converts to print-ready";

export type ArtworkStatus = "pass" | "review" | "blocker";

export interface ArtworkCheck {
  item: string;
  status: ArtworkStatus;
  detail: string;
}

export interface ArtworkTriage {
  source: "upload" | "link";
  kind: "raster" | "vector-or-source" | "link" | "unknown";
  filename: string | null;
  checks: ArtworkCheck[];
  rulesQuote: string;
  rulesSourceUrl: string;
  verdict: ArtworkStatus;
}

const STATUS_RANK: Record<ArtworkStatus, number> = { pass: 0, review: 1, blocker: 2 };

/** Worst status present; "review" only when there are reviews but no blockers. */
function aggregateVerdict(checks: ArtworkCheck[]): ArtworkStatus {
  return checks.reduce<ArtworkStatus>(
    (worst, check) => (STATUS_RANK[check.status] > STATUS_RANK[worst] ? check.status : worst),
    "pass",
  );
}

function triage(base: Omit<ArtworkTriage, "rulesQuote" | "rulesSourceUrl" | "verdict">): ArtworkTriage {
  return {
    ...base,
    rulesQuote: RULES_QUOTE,
    rulesSourceUrl: RULES_SOURCE_URL,
    verdict: aggregateVerdict(base.checks),
  };
}

// ---------------------------------------------------------------------------
// PNG / JPEG byte parsing (no image decoding — headers only)
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  hasTRNS: boolean;
  phys: { ppuX: number; ppuY: number; unit: number } | null;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function parsePngHeader(bytes: Uint8Array): PngHeader | null {
  if (!isPng(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8; // skip signature
  let header: PngHeader | null = null;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    if (dataStart + length + 4 > bytes.length) break; // truncated chunk
    if (type === "IHDR") {
      header = {
        width: view.getUint32(dataStart),
        height: view.getUint32(dataStart + 4),
        bitDepth: bytes[dataStart + 8],
        colorType: bytes[dataStart + 9],
        hasTRNS: false,
        phys: null,
      };
    } else if (type === "pHYs" && header) {
      header.phys = {
        ppuX: view.getUint32(dataStart),
        ppuY: view.getUint32(dataStart + 4),
        unit: bytes[dataStart + 8], // 1 = pixels per metre, 0 = unitless
      };
    } else if (type === "tRNS" && header) {
      header.hasTRNS = true;
    } else if (type === "IEND") {
      break;
    }
    offset = dataStart + length + 4; // skip chunk data + CRC
  }
  return header;
}

interface JfifDensity {
  units: number; // 0 = aspect ratio only, 1 = dots per inch, 2 = dots per cm
  xDensity: number;
  yDensity: number;
}

function parseJfifDensity(bytes: Uint8Array): JfifDensity | null {
  if (!isJpeg(bytes)) return null;
  let offset = 2; // skip SOI
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || marker === 0xff) {
      offset += 2; // standalone markers (SOI, TEM, stuffing)
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // EOI / SOS reached — no APP0 JFIF
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker === 0xe0 && segmentLength >= 16) {
      const ident = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7],
        bytes[offset + 8],
      );
      if (ident === "JFIF\0") {
        return {
          units: bytes[offset + 11],
          xDensity: (bytes[offset + 12] << 8) | bytes[offset + 13],
          yDensity: (bytes[offset + 14] << 8) | bytes[offset + 15],
        };
      }
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function readDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  try {
    const { width, height } = imageSize(bytes);
    if (typeof width === "number" && typeof height === "number") return { width, height };
    return null;
  } catch {
    return null;
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatio(width: number, height: number): string {
  const divisor = gcd(width, height);
  const rw = width / divisor;
  const rh = height / divisor;
  return `${rw}:${rh} (≈${(width / height).toFixed(2)})`;
}

// ---------------------------------------------------------------------------
// Raster triage
// ---------------------------------------------------------------------------

interface ResolutionReading {
  dpi: number | null;
  summary: string;
  unknownReason: string | null;
}

function readResolution(bytes: Uint8Array): ResolutionReading {
  if (isPng(bytes)) {
    const header = parsePngHeader(bytes);
    const phys = header?.phys ?? null;
    if (!phys) {
      return {
        dpi: null,
        summary: "no pHYs chunk",
        unknownReason:
          "DPI metadata missing (no pHYs chunk) — cannot confirm the 300 DPI minimum from the file",
      };
    }
    if (phys.unit !== 1) {
      return {
        dpi: null,
        summary: `pHYs present but unitless (${phys.ppuX} × ${phys.ppuY})`,
        unknownReason: "PNG pHYs chunk has no physical unit — DPI cannot be determined",
      };
    }
    const dpiX = Math.round(phys.ppuX / PPM_PER_INCH);
    const dpiY = Math.round(phys.ppuY / PPM_PER_INCH);
    return {
      dpi: Math.min(dpiX, dpiY),
      summary: `${dpiX} × ${dpiY} DPI (${phys.ppuX} × ${phys.ppuY} pixels per metre)`,
      unknownReason: null,
    };
  }

  if (isJpeg(bytes)) {
    const jfif = parseJfifDensity(bytes);
    if (!jfif) {
      return {
        dpi: null,
        summary: "no JFIF APP0 segment",
        unknownReason:
          "DPI metadata missing (no JFIF APP0 density) — cannot confirm the 300 DPI minimum from the file",
      };
    }
    if (jfif.units === 1) {
      const dpiX = jfif.xDensity;
      const dpiY = jfif.yDensity;
      return { dpi: Math.min(dpiX, dpiY), summary: `${dpiX} × ${dpiY} DPI (JFIF)`, unknownReason: null };
    }
    if (jfif.units === 2) {
      const dpiX = Math.round(jfif.xDensity * 2.54);
      const dpiY = Math.round(jfif.yDensity * 2.54);
      return {
        dpi: Math.min(dpiX, dpiY),
        summary: `${dpiX} × ${dpiY} DPI (JFIF ${jfif.xDensity} × ${jfif.yDensity} dots per cm)`,
        unknownReason: null,
      };
    }
    return {
      dpi: null,
      summary: `JFIF stores aspect ratio only (${jfif.xDensity} × ${jfif.yDensity})`,
      unknownReason: "JPEG JFIF header has no density unit — DPI cannot be determined",
    };
  }

  return {
    dpi: null,
    summary: "not a recognisable PNG or JPEG byte stream",
    unknownReason: "file could not be read as PNG or JPEG",
  };
}

/**
 * Pure raster triage from raw bytes. PNG DPI comes from the pHYs chunk
 * (pixels per metre / 39.3701 = DPI); JPEG DPI from the JFIF APP0 density.
 */
export function triageRasterImage(buffer: Uint8Array, filename: string): ArtworkTriage {
  const checks: ArtworkCheck[] = [];

  const resolution = readResolution(buffer);
  if (resolution.unknownReason || resolution.dpi === null) {
    checks.push({
      item: "resolution",
      status: "review",
      detail: resolution.unknownReason ?? "DPI cannot be determined",
    });
  } else if (resolution.dpi < MIN_DPI) {
    checks.push({
      item: "resolution",
      status: "blocker",
      detail: `${resolution.dpi} DPI — below 300 DPI minimum (Roopac FAQ)`,
    });
  } else {
    checks.push({
      item: "resolution",
      status: "pass",
      detail: `${resolution.summary} — meets the 300 DPI minimum (Roopac FAQ)`,
    });
  }

  const dimensions = readDimensions(buffer);
  if (dimensions) {
    checks.push({
      item: "dimensions",
      status: "pass",
      detail: `${dimensions.width} × ${dimensions.height} px`,
    });
    checks.push({
      item: "aspect-ratio",
      status: "pass",
      detail: `${aspectRatio(dimensions.width, dimensions.height)} — reported only, no judgment`,
    });
  } else {
    checks.push({
      item: "dimensions",
      status: "review",
      detail: "image dimensions could not be read from the file header",
    });
  }

  if (isPng(buffer)) {
    const header = parsePngHeader(buffer);
    if (header && (header.colorType === 6 || header.colorType === 4)) {
      checks.push({
        item: "transparency",
        status: "pass",
        detail: `transparency present (alpha channel, PNG colour type ${header.colorType})`,
      });
    } else if (header?.hasTRNS) {
      checks.push({
        item: "transparency",
        status: "pass",
        detail: "transparency present (tRNS chunk)",
      });
    } else {
      checks.push({
        item: "transparency",
        status: "pass",
        detail: "no transparency detected (opaque PNG)",
      });
    }
  } else if (isJpeg(buffer)) {
    checks.push({
      item: "transparency",
      status: "pass",
      detail: "no transparency — JPEG does not support an alpha channel",
    });
  } else {
    checks.push({
      item: "format",
      status: "blocker",
      detail:
        "file is not a readable PNG/JPEG byte stream (PNG and JPG are the raster formats Roopac accepts)",
    });
  }

  return triage({ source: "upload", kind: "raster", filename, checks });
}

// ---------------------------------------------------------------------------
// Vector / source-file triage
// ---------------------------------------------------------------------------

const VECTOR_EXTENSIONS = ["ai", "pdf", "eps", "psd"] as const;

/** AI / PDF / EPS / PSD are accepted as-is; a designer converts them. */
export function triageVectorFile(filename: string): ArtworkTriage {
  const extension = extensionOf(filename);
  return triage({
    source: "upload",
    kind: "vector-or-source",
    filename,
    checks: [
      {
        item: "format",
        status: "pass",
        detail: `${extension.toUpperCase()} is an accepted artwork format per the Roopac FAQ`,
      },
      { item: "print-conversion", status: "review", detail: VECTOR_CONVERSION_DETAIL },
    ],
  });
}

// ---------------------------------------------------------------------------
// Link triage
// ---------------------------------------------------------------------------

/** Canva / Google Drive hostnames, matched case-insensitively. */
function isAcceptedLinkHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return /canva|googledrive|drive\.google\.com|docs\.google\.com/.test(host);
}

export function triageLink(url: string): ArtworkTriage {
  let hostname: string | null = null;
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = null;
  }

  const checks: ArtworkCheck[] =
    hostname !== null && isAcceptedLinkHost(hostname)
      ? [
          {
            item: "link-source",
            status: "review",
            detail: `${hostname} link accepted — free conversion to print-ready per the Roopac FAQ`,
          },
        ]
      : [
          {
            item: "link-source",
            status: "blocker",
            detail:
              hostname === null
                ? `link must be Canva or Google Drive (Roopac FAQ) — "${url}" is not a parseable URL`
                : "link must be Canva or Google Drive (Roopac FAQ)",
          },
        ];

  return triage({ source: "link", kind: "link", filename: null, checks });
}

// ---------------------------------------------------------------------------
// Upload dispatch
// ---------------------------------------------------------------------------

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

const RASTER_EXTENSIONS = ["png", "jpg", "jpeg"] as const;

export function triageUpload(filename: string, buffer: Uint8Array): ArtworkTriage {
  const extension = extensionOf(filename);
  if ((RASTER_EXTENSIONS as readonly string[]).includes(extension)) {
    return triageRasterImage(buffer, filename);
  }
  if ((VECTOR_EXTENSIONS as readonly string[]).includes(extension)) {
    return triageVectorFile(filename);
  }
  return triage({
    source: "upload",
    kind: "unknown",
    filename,
    checks: [
      {
        item: "format",
        status: "blocker",
        detail: ACCEPTED_FORMATS_DETAIL,
      },
    ],
  });
}
