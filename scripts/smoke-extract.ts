/**
 * Runs the three canonical fixtures against the live OpenAI API and prints
 * the extractions. Requires OPENAI_API_KEY. `npm run smoke:extract`
 */
import { extractRequirements } from "../src/lib/ai/extract";
import { FIXTURES } from "../src/lib/ai/fixtures";
import { currentModelName } from "../src/lib/ai/provider";

try {
  process.loadEnvFile();
} catch {
  /* no .env — rely on real env */
}

console.log(`model: ${currentModelName()}\n`);
for (const f of FIXTURES) {
  try {
    const extract = await extractRequirements(f.message);
    console.log(`--- ${f.id} (${f.label}) ---`);
    console.log(JSON.stringify(extract, null, 2));
  } catch (err: any) {
    console.error(`--- ${f.id} FAILED: ${err.code ?? ""} ${err.message}`);
    process.exitCode = 1;
  }
}
