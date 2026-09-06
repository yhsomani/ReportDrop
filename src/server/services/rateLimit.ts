// D1-backed sliding-window rate limiter
//
// Uses the `rate_limits` table to enforce per-IP, per-user, and per-action limits.
// Pure SQL compatible with both Cloudflare D1 and the in-memory testing engine.

import { D1Database } from '../db/d1Client.js';

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

/**
 * Checks and increments a rate limit bucket.
 *
 * @param db - D1Database instance
 * @param key - Unique rate limit identifier (e.g. `ip:1.2.3.4`, `login:ip:1.2.3.4`, `user:usr_123:reports`)
 * @param limit - Max allowed requests within the window
 * @param windowMs - Duration of the rolling window in milliseconds
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const cleanKey = key.trim().slice(0, 200);

  const row = await db
    .prepare('SELECT key, window_start, count, updated_at FROM rate_limits WHERE key = ?')
    .bind(cleanKey)
    .first<{ key: string; window_start: number; count: number; updated_at: number }>();

  if (!row) {
    await db
      .prepare('INSERT INTO rate_limits (key, window_start, count, updated_at) VALUES (?, ?, ?, ?)')
      .bind(cleanKey, now, 1, now)
      .run();
    return { limited: false, retryAfterSeconds: 0 };
  }

  // Window has elapsed -> start a fresh window
  if (now - row.window_start >= windowMs) {
    await db
      .prepare('UPDATE rate_limits SET window_start = ?, count = ?, updated_at = ? WHERE key = ?')
      .bind(now, 1, now, cleanKey)
      .run();
    return { limited: false, retryAfterSeconds: 0 };
  }

  // Limit reached
  if (row.count >= limit) {
    const remainingMs = row.window_start + windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    return { limited: true, retryAfterSeconds };
  }

  // Below limit -> increment
  await db
    .prepare('UPDATE rate_limits SET count = ?, updated_at = ? WHERE key = ?')
    .bind(row.count + 1, now, cleanKey)
    .run();

  return { limited: false, retryAfterSeconds: 0 };
}
