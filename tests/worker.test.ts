// Unit Tests: Cloudflare Worker Entrypoint (CORS preflight, security headers, JSON parsing, error boundaries)

import { describe, it, expect } from 'vitest';
import worker from '../src/server/worker.js';
import { InMemoryD1Database } from '../src/server/db/d1Client.js';

describe('Cloudflare Worker fetch handler', () => {
  const mockEnv = {
    DB: new InMemoryD1Database(),
    RAZORPAY_KEY_ID: 'rzp_test_worker',
    RAZORPAY_KEY_SECRET: 'secret_worker',
    CORS_ORIGINS: 'https://app.reportdrop.example',
    ENVIRONMENT: 'test'
  };

  it('handles OPTIONS preflight with 204 and CORS + security headers', async () => {
    const req = new Request('https://reportdrop.example/api/workspaces', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.reportdrop.example' }
    });

    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.reportdrop.example');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    const csp = res.headers.get('Content-Security-Policy') || '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('frame-ancestors');
    expect(csp).toContain("script-src 'self' https://checkout.razorpay.com");
  });

  it('omits Access-Control-Allow-Origin for an origin not on the allowlist', async () => {
    const req = new Request('https://reportdrop.example/api/workspaces', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com' }
    });

    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('always allows the request same-origin even without a configured allowlist', async () => {
    const noAllowlistEnv = {
      DB: new InMemoryD1Database(),
      RAZORPAY_KEY_ID: 'rzp_test_worker',
      RAZORPAY_KEY_SECRET: 'secret_worker'
    };
    const req = new Request('https://reportdrop.example/api/workspaces', {
      method: 'OPTIONS',
      headers: { Origin: 'https://reportdrop.example' }
    });

    const res = await worker.fetch(req, noAllowlistEnv);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://reportdrop.example');
  });

  it('handles malformed JSON body on POST requests with 400', async () => {
    const req = new Request('https://reportdrop.example/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://app.reportdrop.example'
      },
      body: 'invalid-json{{{'
    });

    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('BAD_REQUEST');
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('passes valid JSON to the API router and returns 201 on user registration', async () => {
    const req = new Request('https://reportdrop.example/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'worker-test@example.com',
        password: 'Password123!',
        fullName: 'Worker Tester',
        agencyName: 'Worker Agency'
      })
    });

    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.token).toBeTruthy();
    expect(json.user.email).toBe('worker-test@example.com');
  });

  it('handles unauthenticated requests to protected endpoints with 401', async () => {
    const req = new Request('https://reportdrop.example/api/workspaces', {
      method: 'GET'
    });

    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('UNAUTHORIZED');
  });

  it('returns 404 for unknown endpoints when authenticated or public', async () => {
    // 1. Unauthenticated public endpoint unknown -> 404
    const pubReq = new Request('https://reportdrop.example/api/public/reports/unknown_token', {
      method: 'GET'
    });
    const pubRes = await worker.fetch(pubReq, mockEnv);
    expect(pubRes.status).toBe(404);
    const pubJson = await pubRes.json();
    expect(pubJson.error).toBe('NOT_FOUND');

    // 2. Authenticated user reaching non-existent route -> 404
    // First register
    const regReq = new Request('https://reportdrop.example/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'authed-404@example.com', password: 'Password123!', fullName: 'Auth Tester' })
    });
    const regRes = await worker.fetch(regReq, mockEnv);
    const { token } = await regRes.json();

    const authedReq = new Request('https://reportdrop.example/api/unknown-service', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    const authedRes = await worker.fetch(authedReq, mockEnv);
    expect(authedRes.status).toBe(404);
    const authedJson = await authedRes.json();
    expect(authedJson.error).toBe('NOT_FOUND');
  });

  it('returns a structured 500 without leaking internals when the DB throws', async () => {
    const failingDb = {
      prepare: () => {
        throw new Error('sqlite: database disk image is malformed');
      }
    };

    const req = new Request('https://reportdrop.example/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com', password: 'Password123!' })
    });

    const res = await worker.fetch(req, { ...mockEnv, DB: failingDb as any });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('INTERNAL_SERVER_ERROR');
    // The raw upstream error message must NOT be echoed back to the client
    expect(JSON.stringify(json)).not.toContain('malformed');
    expect(JSON.stringify(json)).not.toContain('sqlite');
  });

  it('fails with 500 INSTALLATION_ERROR when the DB binding is missing', async () => {
    const req = new Request('https://reportdrop.example/api/workspaces', {
      method: 'GET'
    });

    const res = await worker.fetch(req, {});
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('INSTALLATION_ERROR');
    expect(json.message).toContain('Database binding');
  });
});
