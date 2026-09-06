-- Migration 0002: Payment order integrity + D1-backed rate limiting
-- Run with: npx wrangler d1 migrations apply reportdrop-production

-- Uniqueness: a given Razorpay payment may only ever finalize one subscription.
-- Partial index (NULL payment ids are 'created' orders still awaiting payment).
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_payment_id
  ON subscriptions (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- General-purpose sliding-window rate limiter (login, payments, reports, global).
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
