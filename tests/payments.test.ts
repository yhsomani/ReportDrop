// Unit Tests: Razorpay Payment Verification & Quota Enforcement (HMAC-SHA256, server-side)

import { describe, it, expect } from 'vitest';
import {
  computeHmacSha256,
  verifyRazorpayPaymentSignature,
  checkUserQuota,
  createRazorpayOrder,
  PRICING_PLANS,
  activateSubscription,
  RazorpayApiError
} from '../src/server/services/payments.js';
import { createTestDb } from './helpers.js';
import { InMemoryD1Database } from '../src/server/db/d1Client.js';

describe('computeHmacSha256', () => {
  it('produces 64-hex-char SHA-256 HMAC', async () => {
    const hmac = await computeHmacSha256('order_1|pay_1', 'secret');
    expect(hmac).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for identical input', async () => {
    const a = await computeHmacSha256('data', 'key');
    const b = await computeHmacSha256('data', 'key');
    expect(a).toBe(b);
  });

  it('changes with different secrets', async () => {
    const a = await computeHmacSha256('data', 'key-a');
    const b = await computeHmacSha256('data', 'key-b');
    expect(a).not.toBe(b);
  });
});

describe('verifyRazorpayPaymentSignature', () => {
  it('rejects when any input field is empty', async () => {
    expect(await verifyRazorpayPaymentSignature('', 'pay_1', 'sig', 'secret')).toBe(false);
    expect(await verifyRazorpayPaymentSignature('order_1', '', 'sig', 'secret')).toBe(false);
    expect(await verifyRazorpayPaymentSignature('order_1', 'pay_1', '', 'secret')).toBe(false);
    expect(await verifyRazorpayPaymentSignature('order_1', 'pay_1', 'sig', '')).toBe(false);
  });

  it('accepts a correctly computed signature', async () => {
    const orderId = 'order_PLvhgQTf1OQ1XH';
    const paymentId = 'pay_PLvhhmWTE9YKt4';
    const secret = 'rzp_test_secret_abc123';

    const expected = await computeHmacSha256(`${orderId}|${paymentId}`, secret);
    expect(await verifyRazorpayPaymentSignature(orderId, paymentId, expected, secret)).toBe(true);
  });

  it('rejects a tampered payment id', async () => {
    const orderId = 'order_AAAA';
    const paymentId = 'pay_ORIGINAL';
    const secret = 'super-secret';

    const expected = await computeHmacSha256(`${orderId}|${paymentId}`, secret);

    // Legitimate signature passes...
    expect(await verifyRazorpayPaymentSignature(orderId, paymentId, expected, secret)).toBe(true);

    // ...but the SAME signature fails when the payment id is swapped to a forged one.
    expect(await verifyRazorpayPaymentSignature(orderId, 'pay_FORGED', expected, secret)).toBe(false);
  });
});

describe('createRazorpayOrder', () => {
  const fakeTransport = (upstreamStatus = 200, payload?: any): typeof fetch => {
    return (async () =>
      new Response(
        JSON.stringify(payload ?? { id: 'order_test_1234567890', amount: 49900, currency: 'INR' }),
        { status: upstreamStatus, headers: { 'Content-Type': 'application/json' } }
      )) as unknown as typeof fetch;
  };

  it('persists a pending subscription row and returns the order details', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const order = await createRazorpayOrder(db, {
      userId: 'usr_buyer',
      plan: 'pro',
      keyId: 'rzp_key_test',
      keySecret: 'secret_test',
      transport: fakeTransport(200, { id: 'order_rzp_abc123' })
    });

    expect(order).toEqual({
      orderId: 'order_rzp_abc123',
      amount: PRICING_PLANS.pro.amount,
      currency: 'INR',
      plan: 'pro',
      keyId: 'rzp_key_test'
    });

    // The order must be stored in the DB with status 'created' BEFORE the user pays.
    const row = await db
      .prepare('SELECT * FROM subscriptions WHERE razorpay_order_id = ?')
      .bind('order_rzp_abc123')
      .first<any>();
    expect(row).toBeDefined();
    expect(row.user_id).toBe('usr_buyer');
    expect(row.status).toBe('created');
    expect(row.amount).toBe(49900);
    expect(row.razorpay_payment_id).toBeNull();
  });

  it('throws a typed RazorpayApiError when the gateway returns a non-2xx status', async () => {
    const db = createTestDb();
    await expect(
      createRazorpayOrder(db, {
        userId: 'usr_buyer',
        plan: 'pro',
        keyId: 'rzp_key_test',
        keySecret: 'secret_test',
        transport: fakeTransport(401, { error: { description: 'Bad credentials' } })
      })
    ).rejects.toThrow(RazorpayApiError);
  });

  it('throws a typed RazorpayApiError when network transport fails', async () => {
    const db = createTestDb();
    const failingTransport = (() => Promise.reject(new Error('DNS lookup failed'))) as unknown as typeof fetch;
    await expect(
      createRazorpayOrder(db, {
        userId: 'usr_buyer',
        plan: 'pro',
        keyId: 'rzp_key_test',
        keySecret: 'secret_test',
        transport: failingTransport
      })
    ).rejects.toThrow(RazorpayApiError);
  });
});

describe('checkUserQuota', () => {
  it('allows free-tier user to create their first report only', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const now = Date.now();

    await db
      .prepare('INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, plan, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('usr_free', 'free@example.com', 'hash', 'salt', 'Owner', 'Agency', 'free', 'inactive', now, now)
      .run();

    let quota = await checkUserQuota(db, 'usr_free');
    expect(quota).toMatchObject({ canCreate: true, used: 0, limit: 1, plan: 'free' });

    // Seed one report
    await db
      .prepare('INSERT INTO reports (id, workspace_id, user_id, report_title, reporting_period, share_token, is_public, data_json, commentary_json, branding_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('rep_1', 'ws_1', 'usr_free', 'First Report', 'October 2026', 'abc'.repeat(11), 1, '{}', '{}', '{}', 'published', now, now)
      .run();

    quota = await checkUserQuota(db, 'usr_free');
    expect(quota.canCreate).toBe(false);
    expect(quota.used).toBe(1);
    expect(quota.limit).toBe(1);
  });

  it('upgrades quota to 5 reports for an active Pro subscription', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const now = Date.now();

    await db
      .prepare('INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, plan, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('usr_pro', 'pro@example.com', 'hash', 'salt', 'Owner', 'Agency', 'pro', 'active', now, now)
      .run();

    // A Pro tier is only effective while a paid subscription's period is live.
    await db
      .prepare('INSERT INTO subscriptions (id, user_id, razorpay_order_id, razorpay_payment_id, plan, amount, currency, status, signature, current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('sub_pro', 'usr_pro', 'order_pro', 'pay_pro', 'pro', 49900, 'INR', 'paid', 'sig', now + (30 * 24 * 60 * 60 * 1000), now, now)
      .run();

    const quota = await checkUserQuota(db, 'usr_pro');
    expect(quota).toMatchObject({ canCreate: true, used: 0, limit: 5, plan: 'pro' });
  });

  it('degrades a pro account whose paid subscription period has lapsed', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const now = Date.now();

    await db
      .prepare('INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, plan, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('usr_lapsed', 'lapsed@example.com', 'hash', 'salt', 'Owner', 'Agency', 'pro', 'active', now, now)
      .run();

    // The only subscription is paid but its period ended 1 day ago.
    await db
      .prepare('INSERT INTO subscriptions (id, user_id, razorpay_order_id, razorpay_payment_id, plan, amount, currency, status, signature, current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('sub_lapsed', 'usr_lapsed', 'order_lapsed', 'pay_lapsed', 'pro', 49900, 'INR', 'paid', 'sig', now - (24 * 60 * 60 * 1000), now, now)
      .run();

    const quota = await checkUserQuota(db, 'usr_lapsed');
    expect(quota.plan).toBe('free');
    expect(quota.limit).toBe(1);

    // The account state is persisted so the client reflects the demotion.
    const user = await db.prepare('SELECT subscription_status FROM users WHERE id = ?').bind('usr_lapsed').first<any>();
    expect(user.subscription_status).toBe('past_due');
  });

  it('demotes a past_due pro subscription back to the free limit', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const now = Date.now();

    await db
      .prepare('INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, plan, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('usr_pd', 'pastdue@example.com', 'hash', 'salt', 'Owner', 'Agency', 'pro', 'past_due', now, now)
      .run();

    const quota = await checkUserQuota(db, 'usr_pd');
    expect(quota.limit).toBe(1);
    expect(quota.plan).toBe('free');
  });
});

describe('activateSubscription', () => {
  it('marks the user as paid Pro and records a subscription + audit event', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const now = Date.now();

    await db
      .prepare('INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, plan, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('usr_pay', 'pay@example.com', 'hash', 'salt', 'Owner', 'Agency', 'free', 'inactive', now, now)
      .run();

    await db
      .prepare(`
        INSERT INTO subscriptions (id, user_id, razorpay_order_id, razorpay_payment_id, plan, amount, currency, status, signature, current_period_end, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind('sub_order1', 'usr_pay', 'order_1', null, 'pro', 49900, 'INR', 'created', null, null, now, now)
      .run();

    const orderRow = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind('sub_order1').first<any>();

    const res = await activateSubscription(db, {
      userId: 'usr_pay',
      order: orderRow,
      paymentId: 'pay_1',
      signature: 'sig_1'
    });
    expect(res.alreadyActive).toBe(false);

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind('usr_pay').first<any>();
    expect(user.plan).toBe('pro');
    expect(user.subscription_status).toBe('active');

    const quota = await checkUserQuota(db, 'usr_pay');
    expect(quota.plan).toBe('pro');
    expect(quota.limit).toBe(5);
  });

  it('is idempotent: re-activating with the same payment id is safe and does not duplicate', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const now = Date.now();

    await db
      .prepare('INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, plan, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('usr_idem', 'idem@example.com', 'hash', 'salt', 'Owner', 'Agency', 'free', 'inactive', now, now)
      .run();

    await db
      .prepare(`
        INSERT INTO subscriptions (id, user_id, razorpay_order_id, razorpay_payment_id, plan, amount, currency, status, signature, current_period_end, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind('sub_idem', 'usr_idem', 'order_idem', null, 'pro', 49900, 'INR', 'created', null, null, now, now)
      .run();

    const orderRow = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind('sub_idem').first<any>();

    const first = await activateSubscription(db, {
      userId: 'usr_idem',
      order: orderRow,
      paymentId: 'pay_idem_1',
      signature: 'sig_idem_1'
    });
    expect(first.alreadyActive).toBe(false);

    const paidRow = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind('sub_idem').first<any>();
    const second = await activateSubscription(db, {
      userId: 'usr_idem',
      order: paidRow,
      paymentId: 'pay_idem_1',
      signature: 'sig_idem_1'
    });
    expect(second.alreadyActive).toBe(true);
  });
});