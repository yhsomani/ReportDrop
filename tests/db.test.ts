// Unit Tests: In-Memory D1 Database Engine (tenant isolation + schema behaviors)

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryD1Database } from '../src/server/db/d1Client.js';
import { createTestDb } from './helpers.js';

describe('InMemoryD1Database', () => {
  let db: InMemoryD1Database;

  beforeEach(() => {
    db = new InMemoryD1Database();
  });

  it('starts with empty tables', async () => {
    const users = await db.prepare('SELECT * FROM users').all<any>();
    expect(users.results).toHaveLength(0);
  });

  it('inserts and selects users by email', async () => {
    const now = Date.now();
    await db
      .prepare('INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, plan, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('usr_1', 'a@b.com', 'h', 's', 'A', 'Agency', 'free', 'inactive', now, now)
      .run();

    const found = await db.prepare('SELECT * FROM users WHERE email = ?').bind('a@b.com').first<any>();
    expect(found!.email).toBe('a@b.com');
    expect(found!.full_name).toBe('A');
  });

  it('reset() clears all rows', async () => {
    const now = Date.now();
    await db
      .prepare('INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, plan, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('usr_1', 'a@b.com', 'h', 's', 'A', 'Agency', 'free', 'inactive', now, now)
      .run();

    db.reset();
    const count = await db.prepare('SELECT COUNT(*) as count FROM reports WHERE user_id = ?').bind('usr_1').first<any>();
    const users = await db.prepare('SELECT * FROM users').all<any>();
    expect(users.results).toHaveLength(0);
    expect(count!.count).toBe(0);
  });

  it('DELETE workspaces cascades to its reports', async () => {
    const now = Date.now();
    await db.prepare('INSERT INTO workspaces (id, user_id, client_name, client_domain, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind('ws_1', 'usr_1', 'Client', 'client.com', 'USD', now, now)
      .run();

    await db
      .prepare('INSERT INTO reports (id, workspace_id, user_id, report_title, reporting_period, share_token, is_public, data_json, commentary_json, branding_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('rep_1', 'ws_1', 'usr_1', 'Report', 'Oct 2026', 't'.repeat(32), 1, '{}', '{}', '{}', 'published', now, now)
      .run();

    await db.prepare('DELETE FROM workspaces WHERE id = ? AND user_id = ?').bind('ws_1', 'usr_1').run();

    const ws = await db.prepare('SELECT * FROM workspaces WHERE id = ? AND user_id = ?').bind('ws_1', 'usr_1').first();
    const rep = await db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?').bind('rep_1', 'usr_1').first();
    expect(ws).toBeNull();
    expect(rep).toBeNull();
  });

  it('refuses cross-tenant workspace delete (wrong user_id)', async () => {
    const now = Date.now();
    await db.prepare('INSERT INTO workspaces (id, user_id, client_name, client_domain, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind('ws_1', 'usr_owner', 'Client', 'client.com', 'USD', now, now)
      .run();

    // Attacker attempts delete with a different user_id
    await db.prepare('DELETE FROM workspaces WHERE id = ? AND user_id = ?').bind('ws_1', 'usr_attacker').run();

    const ws = await db.prepare('SELECT * FROM workspaces WHERE id = ? AND user_id = ?').bind('ws_1', 'usr_owner').first<any>();
    expect(ws).not.toBeNull();
    expect(ws!.user_id).toBe('usr_owner');
  });

  it('query-level ownership checks prevent IDOR reads', async () => {
    const now = Date.now();
    await db
      .prepare('INSERT INTO reports (id, workspace_id, user_id, report_title, reporting_period, share_token, is_public, data_json, commentary_json, branding_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('rep_owner', 'ws_1', 'usr_owner', 'Secret Report', 'Oct 2026', 's'.repeat(32), 1, '{}', '{}', '{}', 'published', now, now)
      .run();

    // Legitimate owner sees the report
    const ownerView = await db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?').bind('rep_owner', 'usr_owner').first();
    expect(ownerView).not.toBeNull();

    // Cross-tenant attacker does NOT see it
    const attackView = await db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?').bind('rep_owner', 'usr_attacker').first();
    expect(attackView).toBeNull();
  });
});

describe('InMemoryD1Database quota counting', () => {
  it('counts reports per user only (tenant-scoped aggregate)', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const now = Date.now();

    await db
      .prepare('INSERT INTO reports (id, workspace_id, user_id, report_title, reporting_period, share_token, is_public, data_json, commentary_json, branding_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('rep_a1', 'ws_1', 'usr_a', 'A1', 'Oct', '1'.repeat(32), 1, '{}', '{}', '{}', 'published', now, now)
      .run();
    await db
      .prepare('INSERT INTO reports (id, workspace_id, user_id, report_title, reporting_period, share_token, is_public, data_json, commentary_json, branding_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('rep_a2', 'ws_1', 'usr_a', 'A2', 'Nov', '2'.repeat(32), 1, '{}', '{}', '{}', 'published', now, now)
      .run();
    await db
      .prepare('INSERT INTO reports (id, workspace_id, user_id, report_title, reporting_period, share_token, is_public, data_json, commentary_json, branding_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('rep_b1', 'ws_2', 'usr_b', 'B1', 'Oct', '3'.repeat(32), 1, '{}', '{}', '{}', 'published', now, now)
      .run();

    const countA = await db.prepare('SELECT COUNT(*) as count FROM reports WHERE user_id = ?').bind('usr_a').first<{ count: number }>();
    const countB = await db.prepare('SELECT COUNT(*) as count FROM reports WHERE user_id = ?').bind('usr_b').first<{ count: number }>();

    expect(countA!.count).toBe(2);
    expect(countB!.count).toBe(1);
  });
});