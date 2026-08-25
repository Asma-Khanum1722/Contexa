/**
 * lib/rateLimit.ts
 * Token-bucket rate limiter backed by Upstash Redis when env vars are
 * present, falling back to an in-process sliding-window for local dev.
 *
 * Usage:
 *   const { limited, remaining } = await checkRateLimit(identifier);
 *   if (limited) throw new RateLimitError();
 */

import { RateLimitError } from "./errors";

// ─── Upstash adapter (production) ────────────────────────────────────────────

// Lazy singleton — reuse the same Ratelimit+Redis instance across requests.
let _ratelimitInstance: any | null = null;

async function getUpstashRatelimit() {
  if (!_ratelimitInstance) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    _ratelimitInstance = { Ratelimit, redis };
  }
  return _ratelimitInstance;
}

async function upstashCheck(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<{ limited: boolean; remaining: number }> {
  const { Ratelimit, redis } = await getUpstashRatelimit();

  // Create per-config limiters — in practice most calls use the same params
  // so this is effectively a singleton per (limit, window) pair.
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: false,
    prefix: "contexa",
  });

  const { success, remaining } = await ratelimit.limit(identifier);
  return { limited: !success, remaining };
}

// ─── In-process adapter (dev / fallback) ─────────────────────────────────────

const inProcessHits = new Map<string, number[]>();
const CLEANUP_INTERVAL_MS = 60_000; // Run cleanup every 60s
let _cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer() {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of inProcessHits.entries()) {
      // Remove entries older than 2 minutes (generous window)
      const fresh = timestamps.filter((t) => now - t < 120_000);
      if (fresh.length === 0) {
        inProcessHits.delete(key);
      } else {
        inProcessHits.set(key, fresh);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent process exit
  if (_cleanupTimer && typeof _cleanupTimer === "object" && "unref" in _cleanupTimer) {
    _cleanupTimer.unref();
  }
}

function inProcessCheck(
  identifier: string,
  limit: number,
  windowSeconds: number
): { limited: boolean; remaining: number } {
  ensureCleanupTimer();
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const arr = (inProcessHits.get(identifier) || []).filter(
    (t) => now - t < windowMs
  );
  arr.push(now);
  inProcessHits.set(identifier, arr);
  const remaining = Math.max(0, limit - arr.length);
  return { limited: arr.length > limit, remaining };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @param identifier   Unique key (e.g. `${botId}:${ip}` or just `botId`)
 * @param limit        Max requests allowed in the window. Default: 30
 * @param windowSeconds Window length in seconds. Default: 60
 */
export async function checkRateLimit(
  identifier: string,
  limit = 30,
  windowSeconds = 60
): Promise<{ limited: boolean; remaining: number }> {
  const hasUpstash =
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (hasUpstash) {
    return upstashCheck(identifier, limit, windowSeconds);
  }

  return inProcessCheck(identifier, limit, windowSeconds);
}

/**
 * Convenience wrapper — throws RateLimitError when limited.
 */
export async function enforceRateLimit(
  identifier: string,
  limit = 30,
  windowSeconds = 60
): Promise<void> {
  const { limited } = await checkRateLimit(identifier, limit, windowSeconds);
  if (limited) throw new RateLimitError();
}
