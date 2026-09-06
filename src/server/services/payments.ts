// Razorpay Payment Gateway, Order Management & Quota Enforcement Engine.
//
// Order lifecycle: create-order POSTs to the real Razorpay Orders API and
// persists a `subscriptions` row with status='created' BEFORE returning the
// order to the client. verify then cross-checks that server-stored order
// (amount/currency/status/user) before accepting a signed payment. This makes
// the payment state derivable only from trusted, server-side data.

import { D1Database, runBatch } from '../db/d1Client.js';
import { timingSafeEqual, generateId } from './auth.js';

export const RAZORPAY_API = 'https://api.razorpay.com/v1/orders';

/** A typed failure from the Razorpay Orders API. Callers map this to a generic
 * 502 to the client; internals (keys, upstream error bodies) are never leaked. */
export class RazorpayApiError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'RazorpayApiError';
    this.statusCode = statusCode;
  }
}

export const PRICING_PLANS = {
  free: {
    name: 'Free Trial',
    amount: 0,
    currency: 'INR',
    reportLimit: 1
  },
  pro: {
    name: 'Pro Agency Plan',
    amount: 49900, // in Paise (₹499.00)
    currency: 'INR',
    reportLimit: 5
  }
};

/**
 * Computes HMAC-SHA256 signature using Web Crypto API.
 */
export async function computeHmacSha256(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(data)
  );

  const bytes = new Uint8Array(signature);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Verifies Razorpay payment signature server-side.
 * Formula: HMAC_SHA256(orderId + "|" + paymentId, secret) === signature
 */
export async function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = await computeHmacSha256(payload, secret);
  return timingSafeEqual(expectedSignature, signature);
}

/**
 * Checks if a user has available quota to create a new report.
 */
export async function checkUserQuota(db: D1Database, userId: string): Promise<{ canCreate: boolean; used: number; limit: number; plan: string }> {
  const user = await db
    .prepare('SELECT plan, subscription_status FROM users WHERE id = ?')
    .bind(userId)
    .first<{ plan: string; subscription_status: string }>();

  // Pro is only effective while the latest subscription's paid period has not
  // lapsed. A `paid` subscription whose current_period_end is in the past no
  // longer entitles the account to the Pro limit.
  const sub = await db
    .prepare('SELECT status, current_period_end FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .first<{ status: string; current_period_end: number | null }>();

  const now = Date.now();
  let periodActive = false;
  if (sub && sub.status === 'paid' && typeof sub.current_period_end === 'number') {
    periodActive = sub.current_period_end > now;
    // A lapsed paid subscription degrades the account from Pro to free. Persist
    // the state change so the client (QuotaBadge) reflects reality.
    if (!periodActive && user?.plan === 'pro' && user?.subscription_status === 'active') {
      await db
        .prepare('UPDATE users SET subscription_status = ?, updated_at = ? WHERE id = ?')
        .bind('past_due', now, userId)
        .run();
    }
  }

  const planTier = (user?.plan === 'pro' && user?.subscription_status === 'active' && periodActive) ? 'pro' : 'free';
  const limit = PRICING_PLANS[planTier].reportLimit;

  const countRow = await db
    .prepare('SELECT COUNT(*) as count FROM reports WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>();

  const used = countRow?.count ?? 0;
  const canCreate = used < limit;

  return {
    canCreate,
    used,
    limit,
    plan: planTier
  };
}

/**
 * Creates a real Razorpay Order against the Orders API and persists a
 * `subscriptions` row with status='created' BEFORE returning the order to the
 * client, so verify can later cross-check that the order genuinely originated
 * from this user at this amount.
 *
 * `transport` is injectable for tests and the offline dev engine; in production
 * it defaults to the platform `fetch`.
 */
export async function createRazorpayOrder(
  db: D1Database,
  opts: {
    userId: string;
    plan: 'pro';
    keyId: string;
    keySecret: string;
    transport?: typeof fetch;
  }
): Promise<{ orderId: string; amount: number; currency: string; plan: string; keyId: string }> {
  const { userId, plan, keyId, keySecret, transport = fetch } = opts;
  const planDetails = PRICING_PLANS[plan];
  const receipt = `rcpt_${userId.slice(0, 12)}_${Date.now()}`;

  const credentials = btoa(`${keyId}:${keySecret}`);

  let response: Response;
  try {
    response = await transport(RAZORPAY_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`
      },
      body: JSON.stringify({
        amount: planDetails.amount,
        currency: planDetails.currency,
        receipt,
        payment_capture: 1,
        notes: { userId, plan }
      })
    });
  } catch (err) {
    console.error('Razorpay Orders API unreachable:', err instanceof Error ? err.message : err);
    throw new RazorpayApiError('Payment gateway is unreachable. Please try again later.');
  }

  if (!response.ok) {
    // Read and log the upstream body server-side only; never forward it to the client.
    const body = await response.text().catch(() => '');
    console.error(`Razorpay Orders API ${response.status}: ${body.slice(0, 300)}`);
    throw new RazorpayApiError('Payment gateway could not create the order. Please try again later.');
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new RazorpayApiError('Payment gateway returned an invalid response.');
  }

  const orderId = typeof payload?.id === 'string' && payload.id ? payload.id : null;
  if (!orderId) {
    throw new RazorpayApiError('Payment gateway returned an invalid order.');
  }

  const now = Date.now();
  const subId = generateId('sub');
  await db
    .prepare(`
      INSERT INTO subscriptions (id, user_id, razorpay_order_id, razorpay_payment_id, plan, amount, currency, status, signature, current_period_end, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      subId,
      userId,
      orderId,
      null, // payment id is unknown until the customer pays
      plan,
      planDetails.amount,
      planDetails.currency,
      'created',
      null,
      null,
      now,
      now
    )
    .run();

  return {
    orderId,
    amount: planDetails.amount,
    currency: planDetails.currency,
    plan,
    keyId
  };
}

/**
 * Activates a Pro subscription idempotently, atomically.
 *
 * Requires the `order` to be the server-stored 'created' subscription row that
 * was persisted when the order was created. All writes (user upgrade,
 * subscription finalization, audit event) are committed in one atomic batch so
 * a crash between them can never leave a paid user un-upgraded.
 *
 * Returns `{ alreadyActive: true }` when the same payment id was already
 * applied — the caller treats that as success without re-extending the period.
 */
export async function activateSubscription(
  db: D1Database,
  opts: {
    userId: string;
    order: any; // the 'created' subscriptions row
    paymentId: string;
    signature: string;
  }
): Promise<{ alreadyActive: boolean }> {
  const { userId, order, paymentId, signature } = opts;
  const now = Date.now();

  // Same order + same payment already finalized → nothing to do.
  if (order.status === 'paid' && order.razorpay_payment_id === paymentId) {
    return { alreadyActive: true };
  }
  // Same order already paid with a DIFFERENT payment id → the caller's job to
  // reject as a conflict (we never double-apply or re-extend).
  if (order.status === 'paid') {
    throw new RazorpayApiError('Order has already been paid.', 409);
  }

  const periodEnd = now + (30 * 24 * 60 * 60 * 1000); // 30 days
  const stmts = [
    db
      .prepare('UPDATE users SET plan = ?, subscription_status = ?, updated_at = ? WHERE id = ?')
      .bind('pro', 'active', now, userId),
    db
      .prepare('UPDATE subscriptions SET razorpay_payment_id = ?, status = ?, signature = ?, current_period_end = ?, updated_at = ? WHERE id = ? AND status = ?')
      .bind(paymentId, 'paid', signature, periodEnd, now, order.id, 'created'),
    db
      .prepare('INSERT INTO audit_events (id, user_id, action, resource_type, resource_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(generateId('evt'), userId, 'payment.verified', 'subscription', order.id, now)
  ];

  await runBatch(db, stmts);
  return { alreadyActive: false };
}
