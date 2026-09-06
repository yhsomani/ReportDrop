// Secure Authentication & Authorization Engine using Web Crypto API

import { D1Database } from '../db/d1Client.js';
import { User } from '../../types/index.js';

// WebCrypto helper to convert ArrayBuffer to Hex String
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// WebCrypto helper to convert Hex String to Uint8Array
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Generates a cryptographically random salt (16 bytes = 32 hex chars).
 */
export function generateSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bufferToHex(salt.buffer);
}

/**
 * Hashes a password using PBKDF2 with SHA-256 and 100,000 iterations.
 */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const saltBytes = hexToBuffer(saltHex);
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );

  return bufferToHex(derivedKey);
}

/**
 * Constant-time comparison of two strings to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verifies a plaintext password against a stored hash and salt.
 */
export async function verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return timingSafeEqual(computedHash, storedHash);
}

/**
 * Generates a cryptographically secure 256-bit random session token.
 */
export function generateSessionToken(): string {
  const token = new Uint8Array(32);
  crypto.getRandomValues(token);
  return bufferToHex(token.buffer);
}

/**
 * Generates an unguessable 128-bit public share token for reports.
 */
export function generateShareToken(): string {
  const token = new Uint8Array(16);
  crypto.getRandomValues(token);
  return bufferToHex(token.buffer);
}

/**
 * Generates a unique UUID v4.
 */
export function generateId(prefix = ''): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}_${uuid.replace(/-/g, '')}` : uuid;
}

/**
 * Validates a session token against the D1 database and returns the authenticated User.
 */
export async function authenticateRequest(db: D1Database, token: string | null): Promise<User | null> {
  if (!token) return null;

  const now = Date.now();
  const sessionRow = await db
    .prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?')
    .bind(token, now)
    .first<{ user_id: string; expires_at: number }>();

  if (!sessionRow) return null;

  const userRow = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(sessionRow.user_id)
    .first<any>();

  if (!userRow) return null;

  return {
    id: userRow.id,
    email: userRow.email,
    fullName: userRow.full_name,
    agencyName: userRow.agency_name || 'My Agency',
    agencyLogo: userRow.agency_logo || undefined,
    accentColor: userRow.accent_color || '#4F46E5',
    plan: userRow.plan || 'free',
    subscriptionStatus: userRow.subscription_status || 'inactive',
    createdAt: userRow.created_at,
    updatedAt: userRow.updated_at
  };
}
