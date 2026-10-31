/**
 * lib/rateLimit.ts
 * Token-bucket rate limiter backed by Upstash Redis when env vars are
 * present, falling back to an in-process sliding-window for local dev.
 */

import { RateLimitError } from "./errors";

// ─── Upstash adapter (production) ────────────────────────────────────────────

let _ratelimitInstance: any | null = null;

async function getUpstashRatelimit() {
  if (!_ratelimitInstance) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!.replace(/^"|"$/g, ""),
      token: process.env.UPSTASH_REDIS_REST_TOKEN!.replace(/^"|"$/g, ""),
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
const CLEANUP_INTERVAL_MS = 60_000;
let _cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer() {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of inProcessHits.entries()) {
      const fresh = timestamps.filter((t) => now - t < 120_000);
      if (fresh.length === 0) {
        inProcessHits.delete(key);
      } else {
        inProcessHits.set(key, fresh);
      }
    }
  }, CLEANUP_INTERVAL_MS);
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

let _upstashUnavailableUntil = 0;

export async function checkRateLimit(
  identifier: string,
  limit = 30,
  windowSeconds = 60
): Promise<{ limited: boolean; remaining: number }> {
  const hasUpstash =
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (hasUpstash && Date.now() >= _upstashUnavailableUntil) {
    try {
      return await upstashCheck(identifier, limit, windowSeconds);
    } catch (err: any) {
      _upstashUnavailableUntil = Date.now() + 60_000;
      console.warn("[rateLimit] Upstash Redis request failed, disabling for 60s:", err?.message || err);
      return inProcessCheck(identifier, limit, windowSeconds);
    }
  }

  return inProcessCheck(identifier, limit, windowSeconds);
}

export async function enforceRateLimit(
  identifier: string,
  limit = 30,
  windowSeconds = 60
): Promise<void> {
  const { limited } = await checkRateLimit(identifier, limit, windowSeconds);
  if (limited) throw new RateLimitError();
}
