// Integration Tests: Server-side session lifecycle
//
// Covers logout revocation (DELETE /api/auth/session invalidates the token so it
// can no longer authenticate), and the expired-session sweep that runs on login
// so stale sessions do not accumulate.

import { describe, it, expect, beforeEach } from 'vitest';
import { handleApiRequest } from '../src/server/routes/api.js';
import { createTestDb, registerTestUser, loginTestUser } from './helpers.js';
import { D1Database } from '../src/server/db/d1Client.js';

describe('Session lifecycle', () => {
  let db: D1Database;
  beforeEach(() => {
    db = createTestDb();
  });

  it('revokes the current session so the token can no longer authenticate', async () => {
    const { token } = await registerTestUser(db, 'revoke@example.com');

    // Token works before revocation.
    const before = await handleApiRequest(db, {
      method: 'GET',
      url: '/api/auth/me',
      headers: new Headers({ Authorization: `Bearer ${token}` }),
      env: {}
    });
    expect(before.status).toBe(200);

    // Revoke it.
    const revoke = await handleApiRequest(db, {
      method: 'DELETE',
      url: '/api/auth/session',
      headers: new Headers({ Authorization: `Bearer ${token}` }),
      env: {}
    });
    expect(revoke.status).toBe(200);
    expect(revoke.data).toMatchObject({ success: true });

    // The same token is now rejected.
    const after = await handleApiRequest(db, {
      method: 'GET',
      url: '/api/auth/me',
      headers: new Headers({ Authorization: `Bearer ${token}` }),
      env: {}
    });
    expect(after.status).toBe(401);
    expect(after.error).toBe('UNAUTHORIZED');
  });

  it('revokes only the current session, not other sessions for the same user', async () => {
    await registerTestUser(db, 'multi@example.com');
    const sessionA = await loginTestUser(db, 'multi@example.com');
    const sessionB = await loginTestUser(db, 'multi@example.com');

    const revokeA = await handleApiRequest(db, {
      method: 'DELETE',
      url: '/api/auth/session',
      headers: new Headers({ Authorization: `Bearer ${sessionA.token}` }),
      env: {}
    });
    expect(revokeA.status).toBe(200);

    // Session B remains valid.
    const checkB = await handleApiRequest(db, {
      method: 'GET',
      url: '/api/auth/me',
      headers: new Headers({ Authorization: `Bearer ${sessionB.token}` }),
      env: {}
    });
    expect(checkB.status).toBe(200);
  });

  it('sweeps expired sessions on login', async () => {
    const { userId } = await registerTestUser(db, 'sweep@example.com');

    // Insert an already-expired session directly into the table.
    const expiredToken = 'expiredtoken'.padEnd(43, 'x');
    await db
      .prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(expiredToken, userId, Date.now() - 1000, Date.now() - 100000)
      .run();

    // Login triggers the sweep.
    await loginTestUser(db, 'sweep@example.com');

    const expiredRow = await db
      .prepare('SELECT token FROM sessions WHERE token = ?')
      .bind(expiredToken)
      .first<any>();
    expect(expiredRow).toBeNull();
  });
});
