/**
 * Minimal per-IP rate limit for the public demo endpoints. In-memory, so on
 * serverless each warm instance counts separately — fine for keeping a job
 * demo from being hammered; not a production abuse solution (ponytail:
 * swap for a shared store if this ever leaves demo duty).
 */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 20;

const hits = new Map<string, number[]>();

export function rateLimit(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    hits.set(ip, recent);
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  hits.set(ip, recent);
  // opportunistic cleanup so the map can't grow unbounded
  if (hits.size > 1000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return { ok: true };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
