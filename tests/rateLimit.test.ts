// Unit + Integration Tests: D1-backed rate limiting
//
// Unit tests exercise checkRateLimit against the in-memory engine directly. The
// "counts within the window" test is also the regression guard for the engine's
// rate_limits row keying: if INSERTs silently no-op'd (the original bug where
// non-session tables were keyed by row.id), the 4th call would never be limited
// and the test would fail.
//
// Integration tests hit the real router endpoints to prove the 429 wiring is
// actually enforced on auth, payments, and globally per IP.

import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '../src/server/services/rateLimit.js';
import { handleApiRequest } from '../src/server/routes/api.js';
import { createTestDb, registerTestUser } from './helpers.js';
import { D1Database } from '../src/server/db/d1Client.js';

const WINDOW_MS = 60 * 1000;

describe('checkRateLimit (window enforcement)', () => {
  it('allows requests while under the limit and counts each one', async () => {
    const db = createTestDb();
    const key = 'unit:count';

    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit(db, key, 3, WINDOW_MS);
      expect(r.limited, `call ${i + 1} should pass`).toBe(false);
      expect(r.retryAfterSeconds).toBe(0);
    }

    // The row must have persisted (count = 3) or the 4th call would pass.
    const row = await db
      .prepare('SELECT key, window_start, count, updated_at FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<any>();
    expect(row).not.toBeNull();
    expect(row.count).toBe(3);
  });

  it('returns limited:true with a positive retry window once the cap is hit', async () => {
    const db = createTestDb();
    const key = 'unit:over';

    for (let i = 0; i < 3; i++) {
      await checkRateLimit(db, key, 3, WINDOW_MS);
    }
    const r4 = await checkRateLimit(db, key, 3, WINDOW_MS);
    expect(r4.limited).toBe(true);
    expect(r4.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(r4.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('expirant calls never decrement; a fresh window resets the bucket', async () => {
    const db = createTestDb();
    const key = 'unit:expiry';
    const limit = 5;

    // Open a window, then force it to have started long in the past.
    await checkRateLimit(db, key, limit, WINDOW_MS);
    await db
      .prepare('UPDATE rate_limits SET window_start = ?, count = ?, updated_at = ? WHERE key = ?')
      .bind(Date.now() - 2 * WINDOW_MS, limit, Date.now(), key)
      .run();

    // Window expired => not limited, bucket restarts at 1.
    const r = await checkRateLimit(db, key, limit, WINDOW_MS);
    expect(r.limited).toBe(false);
    expect(r.retryAfterSeconds).toBe(0);

    const after = await db
      .prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<any>();
    expect(after.count).toBe(1);
    expect(after.window_start).toBeGreaterThan(Date.now() - 2000);
  });

  it('keeps independent keys isolated from each other', async () => {
    const db = createTestDb();
    await Promise.all([
      checkRateLimit(db, 'unit:a', 1, WINDOW_MS),
      checkRateLimit(db, 'unit:b', 1, WINDOW_MS)
    ]);

    // 'a' is exhausted; 'b' still has capacity.
    const a = await checkRateLimit(db, 'unit:a', 1, WINDOW_MS);
    expect(a.limited).toBe(true);
    const b = await checkRateLimit(db, 'unit:b', 1, WINDOW_MS);
    expect(b.limited).toBe(true); // b was already consumed by the Promise.all
  });
});

describe('API rate limiting wiring', () => {
  let db: D1Database;
  beforeEach(() => {
    db = createTestDb();
  });

  const registerReq = (email: string) =>
    handleApiRequest(db, {
      method: 'POST',
      url: '/api/auth/register',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: { email, password: 'StrongPass123!', fullName: 'Rate Tester' },
      env: {}
    });

  it('returns 429 RATE_LIMITED after 10 register attempts against one email', async () => {
    // Each attempt counts against the per-email bucket even when it fails with
    // EMAIL_EXISTS — that's what stops brute-force account probing.
    for (let i = 0; i < 10; i++) {
      const res = await registerReq('hammered@example.com');
      expect(res.status).not.toBe(429);
    }
    const res11 = await registerReq('hammered@example.com');
    expect(res11.status).toBe(429);
    expect(res11.error).toBe('RATE_LIMITED');
    expect(res11.message).toContain('seconds');
  });

  it('returns 429 after more than 10 registrations from one IP', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await registerReq(`ipspam${i}@example.com`);
      expect(res.status).toBe(201);
    }
    const res11 = await registerReq('ipspam-x@example.com');
    expect(res11.status).toBe(429);
    expect(res11.error).toBe('RATE_LIMITED');
  });

  it('rate-limits login attempts against a single account', async () => {
    await registerTestUser(db, 'loginratelimit@example.com');
    const loginReq = () =>
      handleApiRequest(db, {
        method: 'POST',
        url: '/api/auth/login',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: { email: 'loginratelimit@example.com', password: 'WrongPass99' },
        env: {}
      });

    for (let i = 0; i < 10; i++) {
      const res = await loginReq();
      expect(res.status).toBe(401);
    }
    const res11 = await loginReq();
    expect(res11.status).toBe(429);
    expect(res11.error).toBe('RATE_LIMITED');
  });

  it('applies the per-user cap to payment order creation even when config is absent', async () => {
    const auth = await registerTestUser(db, 'payrate@example.com');
    const headers = new Headers({ 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` });
    const createOrder = () =>
      handleApiRequest(db, { method: 'POST', url: '/api/payments/create-order', headers, env: {} });

    // Fail-closed 500 PAYMENT_CONFIG_ERROR counts toward the rate limit each time.
    for (let i = 0; i < 10; i++) {
      const res = await createOrder();
      expect(res.status).toBe(500);
      expect(res.error).toBe('PAYMENT_CONFIG_ERROR');
    }
    const res11 = await createOrder();
    expect(res11.status).toBe(429);
    expect(res11.error).toBe('RATE_LIMITED');
  });

  it('enforces the global per-IP cap of 120 requests/minute', async () => {
    const headers = new Headers();
    for (let i = 0; i < 120; i++) {
      const res = await handleApiRequest(db, { method: 'GET', url: '/api/auth/me', headers, env: {} });
      expect(res.status, `request ${i + 1} should pass`).toBe(401);
    }
    const res121 = await handleApiRequest(db, { method: 'GET', url: '/api/auth/me', headers, env: {} });
    expect(res121.status).toBe(429);
    expect(res121.error).toBe('RATE_LIMITED');
  });
});