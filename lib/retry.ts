/**
 * lib/retry.ts
 * Generic retry wrapper with exponential backoff and jitter.
 * Use this to wrap any Gemini or Pinecone call.
 *
 * Example:
 *   const result = await withRetry(() => embedModel.embedContent(text));
 */

export interface RetryOptions {
  /** Max number of attempts (including the first). Default: 3 */
  attempts?: number;
  /** Base delay in ms before the first retry. Default: 500 */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. Default: 10_000 */
  maxDelayMs?: number;
  /** Optional predicate — if it returns false, stop retrying immediately. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Adds ±20 % jitter to avoid thundering-herd on concurrent retries. */
function jitter(ms: number): number {
  return ms * (0.8 + Math.random() * 0.4);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 10_000,
    shouldRetry = () => true,
  } = options;

  let lastErr: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (attempt === attempts || !shouldRetry(err, attempt)) {
        break;
      }

      const delay = Math.min(
        jitter(baseDelayMs * Math.pow(2, attempt - 1)),
        maxDelayMs
      );

      console.warn(
        `[retry] Attempt ${attempt}/${attempts} failed — retrying in ${Math.round(delay)}ms`,
        err instanceof Error ? err.message : err
      );

      await sleep(delay);
    }
  }

  throw lastErr;
}
