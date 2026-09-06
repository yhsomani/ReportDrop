// Unit Tests: Authentication Engine (PBKDF2, timing-safe compare, session/share tokens)

import { describe, it, expect } from 'vitest';
import {
  generateSalt,
  hashPassword,
  verifyPassword,
  timingSafeEqual,
  generateSessionToken,
  generateShareToken,
  generateId,
  authenticateRequest
} from '../src/server/services/auth.js';
import { createTestDb } from './helpers.js';
import { InMemoryD1Database } from '../src/server/db/d1Client.js';

describe('generateSalt', () => {
  it('produces a 32-hex-character (128-bit) salt', () => {
    const salt = generateSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique salts each call', () => {
    expect(generateSalt()).not.toBe(generateSalt());
  });
});

describe('hashPassword / verifyPassword (PBKDF2-SHA256)', () => {
  it('produces a deterministic 64-hex-char (SHA-256) hash for fixed input', async () => {
    const salt = generateSalt();
    const hash = await hashPassword('SecurePass!200', salt);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    const again = await hashPassword('SecurePass!200', salt);
    expect(again).toBe(hash);
  });

  it('verifies correct passwords and rejects incorrect ones', async () => {
    const salt = generateSalt();
    const hash = await hashPassword('hunter2-secret', salt);

    expect(await verifyPassword('hunter2-secret', hash, salt)).toBe(true);
    expect(await verifyPassword('wrong-password', hash, salt)).toBe(false);
  });

  it('produces different hashes for different salts with the same password', async () => {
    const h1 = await hashPassword('same-pass', generateSalt());
    const h2 = await hashPassword('same-pass', generateSalt());
    expect(h1).not.toBe(h2);
  });
});

describe('timingSafeEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
  });

  it('short-circuits on length mismatch (does not throw)', () => {
    expect(timingSafeEqual('short', 'much-longer-string')).toBe(false);
  });

  it('handles empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
    expect(timingSafeEqual('', 'x')).toBe(false);
  });
});

describe('token generation', () => {
  it('generateSessionToken is a 256-bit (64 hex) token', () => {
    expect(generateSessionToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateShareToken is a 128-bit (32 hex) unguessable token', () => {
    expect(generateShareToken()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('share tokens are unique across many draws', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateShareToken()));
    expect(tokens.size).toBe(100);
  });

  it('generateId produces prefixed uuid without dashes', () => {
    expect(generateId('rep')).toMatch(/^rep_[0-9a-f]{32}$/);
  });
});

describe('authenticateRequest', () => {
  it('returns null for a missing token', async () => {
    const db = createTestDb();
    expect(await authenticateRequest(db, null)).toBeNull();
  });

  it('returns null for an unknown token', async () => {
    const db = createTestDb();
    expect(await authenticateRequest(db, 'a'.repeat(64))).toBeNull();
  });

  it('resolves a valid session back to its user', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const now = Date.now();
    const userId = 'usr_test_user_1';

    // Seed a user then a session directly
    await db
      .prepare('INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, plan, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(userId, 'owner@example.com', 'hash', 'salt', 'Agency Owner', 'My Agency', 'free', 'inactive', now, now)
      .run();

    const token = 'f'.repeat(64);
    await db
      .prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(token, userId, now + 86_400_000, now)
      .run();

    const user = await authenticateRequest(db, token);
    expect(user).not.toBeNull();
    expect(user!.id).toBe(userId);
    expect(user!.email).toBe('owner@example.com');
    expect(user!.agencyName).toBe('My Agency');
  });

  it('rejects expired sessions', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const now = Date.now();
    const userId = 'usr_expired';

    await db
      .prepare('INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, plan, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(userId, 'expired@example.com', 'hash', 'salt', 'Agency Owner', 'My Agency', 'free', 'inactive', now, now)
      .run();

    const token = 'e'.repeat(64);
    await db
      .prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(token, userId, now - 1000, now) // expires in the past
      .run();

    expect(await authenticateRequest(db, token)).toBeNull();
  });
});