/**
 * Simple in-memory rate limiter.
 * Uses a sliding window approach per IP address.
 * Easy to replace with Redis-backed or more robust solution later.
 */

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  /**
   * @param maxRequests Maximum number of requests allowed in the window
   * @param windowMs Time window in milliseconds
   */
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Cleanup old entries every minute
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Check if a request from the given key (typically IP) should be allowed.
   * Returns true if allowed, false if rate limited.
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      this.store.set(key, { timestamps: [now] });
      return true;
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);

    if (entry.timestamps.length >= this.maxRequests) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }

  /**
   * Get remaining requests for a key.
   */
  remaining(key: string): number {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry) return this.maxRequests;

    const validTimestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - validTimestamps.length);
  }

  /**
   * Remove expired entries from the store.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
  }
}

// ─── Pre-configured rate limiters ───────────────────────────────────────────

/** Rate limiter for POST /calls: max 5 per IP per minute */
export const createCallLimiter = new RateLimiter(5, 60_000);

/** Rate limiter for invalid token access: max 10 different invalid tokens per IP per minute */
export const tokenScanLimiter = new RateLimiter(10, 60_000);
