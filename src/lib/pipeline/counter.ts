import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Job numbers RB-<YYYYMMDD>-<seq> from a JSON counter file — demonstrates
 * state handling without a database. On serverless the counter lives in /tmp
 * (the only writable path there), so sequences work per warm instance; two
 * instances could still pick the same number, which is acceptable for a
 * prototype and documented in the README.
 */

const RUNTIME_DIR =
  process.env.JOB_COUNTER_DIR ?? (process.env.VERCEL ? path.join(os.tmpdir(), "roopac-brief") : path.join(process.cwd(), ".runtime"));

export async function nextJobNumber(now = new Date()): Promise<string> {
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  const file = path.join(RUNTIME_DIR, `job-counter-${day}.json`);
  let seq = 1;
  try {
    const raw = JSON.parse(await readFile(file, "utf8"));
    if (typeof raw.seq === "number") seq = raw.seq + 1;
  } catch {
    /* first job of the day */
  }
  try {
    await mkdir(RUNTIME_DIR, { recursive: true });
    await writeFile(file, JSON.stringify({ seq, updatedAt: now.toISOString() }));
  } catch {
    /* read-only fs: numbers may repeat — acceptable, documented */
  }
  return `RB-${day}-${String(seq).padStart(3, "0")}`;
}
