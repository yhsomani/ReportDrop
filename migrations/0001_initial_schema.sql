-- Migration 0001: Initial Schema
-- Matches src/server/db/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  full_name TEXT NOT NULL,
  agency_name TEXT DEFAULT 'My Agency',
  agency_logo TEXT,
  accent_color TEXT DEFAULT '#4F46E5',
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro')),
  subscription_status TEXT DEFAULT 'inactive' CHECK(subscription_status IN ('active', 'inactive', 'past_due')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_domain TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  report_title TEXT NOT NULL,
  reporting_period TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  is_public INTEGER DEFAULT 0 CHECK(is_public IN (0, 1)),
  data_json TEXT NOT NULL,
  commentary_json TEXT NOT NULL,
  branding_json TEXT NOT NULL,
  status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_workspace_id ON reports(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_share_token ON reports(share_token);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL CHECK(status IN ('created', 'paid', 'failed')),
  signature TEXT,
  current_period_end INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_order_id ON subscriptions(razorpay_order_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
