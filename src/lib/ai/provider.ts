import { createOpenAI } from "@ai-sdk/openai";

/**
 * The only module allowed to import an AI SDK provider. Every other module
 * goes through getModel() so swapping providers is a one-line change here.
 */

export class MissingApiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not set. Add it to .env (see .env.example).");
    this.name = "MissingApiKeyError";
  }
}

export function currentModelName(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

/** Single configured model handle. API key is required at call time, not import time. */
export function getModel() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();
  const openai = createOpenAI({ apiKey });
  return openai(currentModelName());
}
