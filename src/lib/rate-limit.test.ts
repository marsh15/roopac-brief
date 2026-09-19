import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });
  afterEach(() => vi.useRealTimers());

  async function limiter() {
    const mod = await import("./rate-limit");
    return mod.rateLimit;
  }

  it("allows requests under the limit and blocks at the cap", async () => {
    const rateLimit = await limiter();
    for (let i = 0; i < 20; i++) {
      expect(rateLimit("1.2.3.4")).toMatchObject({ ok: true });
    }
    expect(rateLimit("1.2.3.4")).toMatchObject({ ok: false });
    // other IPs are unaffected
    expect(rateLimit("5.6.7.8")).toMatchObject({ ok: true });
  });

  it("reports a retry-after inside the window and recovers after it", async () => {
    const rateLimit = await limiter();
    for (let i = 0; i < 20; i++) rateLimit("9.9.9.9");
    const blocked = rateLimit("9.9.9.9");
    expect(blocked).toMatchObject({ ok: false });
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(rateLimit("9.9.9.9")).toMatchObject({ ok: true });
  });
});
