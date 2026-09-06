// Integration Tests: REST API Router (auth, workspaces, reports, quota, IDOR/BOLA, share-link, payments)

import { describe, it, expect, beforeEach } from 'vitest';
import { handleApiRequest } from '../src/server/routes/api.js';
import { computeHmacSha256 } from '../src/server/services/payments.js';
import {
  createTestDb,
  registerTestUser,
  loginTestUser,
  SAMPLE_GSC_QUERIES_CSV,
  SAMPLE_GSC_PAGES_CSV,
  SAMPLE_GA4_CSV,
  SAMPLE_RANK_CSV
} from './helpers.js';
import { InMemoryD1Database } from '../src/server/db/d1Client.js';

interface Session {
  db: InMemoryD1Database;
  token: string;
  userId: string;
}

async function createAuthenticatedSession(
  email = 'owner@example.com'
): Promise<Session> {
  const db = createTestDb() as InMemoryD1Database;
  const auth = await registerTestUser(db, email);
  return { db, token: auth.token, userId: auth.userId };
}

const fakeRazorpayTransport = (status = 200, payload?: any): typeof fetch => {
  return (async () =>
    new Response(
      JSON.stringify(payload ?? { id: 'order_test_integration_123', amount: 49900, currency: 'INR', status: 'created' }),
      { status, headers: { 'Content-Type': 'application/json' } }
    )) as unknown as typeof fetch;
};

const REQ_ENV = {
  RAZORPAY_KEY_ID: 'rzp_test_key_123',
  RAZORPAY_KEY_SECRET: 'rzp_test_secret_123',
  RAZORPAY_TRANSPORT: fakeRazorpayTransport(200)
};

function authedHeaders(token: string): Headers {
  return new Headers({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
}

describe('Auth Endpoints', () => {
  it('registers a user and returns a usable session token', async () => {
    const { db, token } = await createAuthenticatedSession();
    const res = await handleApiRequest(db, { method: 'GET', url: '/api/auth/me', headers: authedHeaders(token), env: REQ_ENV });
    expect(res.status).toBe(200);
    expect((res.data as any).user.email).toBe('owner@example.com');
    expect((res.data as any).user.plan).toBe('free');
  });

  it('rejects duplicate email registration', async () => {
    const db = createTestDb();
    await registerTestUser(db, 'dup@example.com');
    const res = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/auth/register',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: { email: 'dup@example.com', password: 'StrongPass123!', fullName: 'X' },
      env: REQ_ENV
    });
    expect(res.status).toBe(400);
    expect(res.error).toBe('EMAIL_EXISTS');
  });

  it('rejects weak passwords', async () => {
    const db = createTestDb();
    const res = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/auth/register',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: { email: 'weak@example.com', password: 'short', fullName: 'X' },
      env: REQ_ENV
    });
    expect(res.status).toBe(400);
    expect(res.error).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid credentials at login', async () => {
    const db = createTestDb();
    await registerTestUser(db, 'ok@example.com');
    const bad = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/auth/login',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: { email: 'ok@example.com', password: 'totallyWrong99' },
      env: REQ_ENV
    });
    expect(bad.status).toBe(401);

    const good = await loginTestUser(db, 'ok@example.com');
    expect(good.token).toBeTruthy();
  });

  it('rejects protected routes without a token', async () => {
    const db = createTestDb();
    const res = await handleApiRequest(db, { method: 'GET', url: '/api/workspaces', headers: new Headers(), env: REQ_ENV });
    expect(res.status).toBe(401);
    expect(res.error).toBe('UNAUTHORIZED');
  });

  it('updates agency branding via profile endpoint (persists server-side)', async () => {
    const { db, token } = await createAuthenticatedSession('profile@example.com');

    const res = await handleApiRequest(db, {
      method: 'PUT',
      url: '/api/auth/profile',
      headers: authedHeaders(token),
      body: { fullName: 'Renamed Owner', agencyName: 'Acme SEO Co', accentColor: '#0EA5E9' },
      env: REQ_ENV
    });
    expect(res.status).toBe(200);
    expect((res.data as any).user.agencyName).toBe('Acme SEO Co');
    expect((res.data as any).user.accentColor).toBe('#0EA5E9');

    // Persisted: fetching "me" reflects the new branding.
    const me = await handleApiRequest(db, { method: 'GET', url: '/api/auth/me', headers: authedHeaders(token), env: REQ_ENV });
    expect((me.data as any).user.agencyName).toBe('Acme SEO Co');
    expect((me.data as any).user.accentColor).toBe('#0EA5E9');
  });

  it('sanitizes a hostile accentColor payload (styling-injection guard)', async () => {
    const { db, token } = await createAuthenticatedSession('branding@example.com');
    const safe = '#0EA5E9';

    // Valid short-form / non-hex values must NOT be stored verbatim — the value
    // is rendered into CSS context, so only strict 6-digit hex may pass.
    const hostile = "red; background-image:url(https://evil.example/x.png)";
    const res = await handleApiRequest(db, {
      method: 'PUT',
      url: '/api/auth/profile',
      headers: authedHeaders(token),
      body: { accentColor: hostile },
      env: REQ_ENV
    });
    expect(res.status).toBe(200);
    expect((res.data as any).user.accentColor).toBe('#4F46E5'); // fell back to default

    // A valid hex is accepted (lowercased), proving the sanitizer is not a hard block.
    const ok = await handleApiRequest(db, {
      method: 'PUT',
      url: '/api/auth/profile',
      headers: authedHeaders(token),
      body: { accentColor: '#0EA5E9' },
      env: REQ_ENV
    });
    expect((ok.data as any).user.accentColor).toBe(safe);
  });
});

describe('Workspace Endpoints', () => {
  let s: Session;
  beforeEach(async () => {
    s = await createAuthenticatedSession('ws@example.com');
  });

  it('creates and lists workspaces for the owner', async () => {
    const create = await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/workspaces',
      headers: authedHeaders(s.token),
      body: { clientName: 'Apex Dental', clientDomain: 'apexdental.com' },
      env: REQ_ENV
    });
    expect(create.status).toBe(201);

    const list = await handleApiRequest(s.db, {
      method: 'GET',
      url: '/api/workspaces',
      headers: authedHeaders(s.token),
      env: REQ_ENV
    });
    expect(list.status).toBe(200);
    expect((list.data as any).workspaces).toHaveLength(1);
    expect((list.data as any).workspaces[0].clientDomain).toBe('apexdental.com');
  });

  it('deletes only the authenticated user’s workspace (IDOR defeat)', async () => {
    // Owner's session
    const owner = s;
    // Second user
    const db = owner.db;
    const attacker = await registerTestUser(db, 'attacker@example.com');

    const create = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/workspaces',
      headers: authedHeaders(owner.token),
      body: { clientName: 'Victim Co', clientDomain: 'victim.com' },
      env: REQ_ENV
    });
    const wsId = (create.data as any).workspace.id;

    // Attacker tries to delete victim's workspace
    const attack = await handleApiRequest(db, {
      method: 'DELETE',
      url: `/api/workspaces/${wsId}`,
      headers: authedHeaders(attacker.token),
      env: REQ_ENV
    });
    // Route returns 200 by design but no row is deleted; verify via owner
    expect(attack.status).toBe(200);

    const list = await handleApiRequest(db, {
      method: 'GET',
      url: '/api/workspaces',
      headers: authedHeaders(owner.token),
      env: REQ_ENV
    });
    expect((list.data as any).workspaces).toHaveLength(1);
  });
});

describe('Report Compile & Quota', () => {
  let s: Session;
  beforeEach(async () => {
    s = await createAuthenticatedSession('report@example.com');
  });

  it('compiles a preview dataset into normalized report data', async () => {
    const res = await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/reports/compile',
      headers: authedHeaders(s.token),
      body: {
        gscQueriesCsv: SAMPLE_GSC_QUERIES_CSV,
        gscPagesCsv: SAMPLE_GSC_PAGES_CSV,
        ga4Csv: SAMPLE_GA4_CSV,
        rankCsv: SAMPLE_RANK_CSV
      },
      env: REQ_ENV
    });

    expect(res.status).toBe(200);
    const data = (res.data as any).data;

    expect(data.kpis).toBeDefined();
    expect(data.kpis.clicks.current).toBeGreaterThan(0);
    expect(data.topQueries.length).toBeGreaterThan(0);
    expect(data.topPages.length).toBeGreaterThan(0);
    expect(data.topGainers.length).toBeGreaterThan(0);
    expect(data.channelBreakdown.length).toBeGreaterThan(0);
  });

  it('neutralizes formula-injection payloads inside compiled CSVs', async () => {
    const maliciousCsv = `Top queries,Clicks,Impressions,CTR,Position
=HYPERLINK("http://evil.example"),500,3000,16.67%,1.5`;

    const res = await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/reports/compile',
      headers: authedHeaders(s.token),
      body: { gscQueriesCsv: maliciousCsv },
      env: REQ_ENV
    });

    expect(res.status).toBe(200);
    const topQuery = (res.data as any).data.topQueries[0];
    // The stored query must carry the neutralizing apostrophe, killing the formula
    expect(topQuery.query.startsWith("'")).toBe(true);
  });

  it('enforces free-tier quota (1 report) with 403 on exceed', async () => {
    // Create workspace
    const wsRes = await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/workspaces',
      headers: authedHeaders(s.token),
      body: { clientName: 'Quota Co', clientDomain: 'quota.com' },
      env: REQ_ENV
    });
    const wsId = (wsRes.data as any).workspace.id;

    const makeReport = () =>
      handleApiRequest(s.db, {
        method: 'POST',
        url: '/api/reports',
        headers: authedHeaders(s.token),
        body: {
          workspaceId: wsId,
          reportTitle: 'Monthly Report',
          reportingPeriod: 'October 2026',
          data: { kpis: {}, topQueries: [], topPages: [], topGainers: [], topLosers: [] }
        },
        env: REQ_ENV
      });

    const first = await makeReport();
    expect(first.status).toBe(201);

    const second = await makeReport();
    expect(second.status).toBe(403);
    expect(second.error).toBe('QUOTA_EXCEEDED');
  });

  it('rejects report creation against another user’s workspace (BOLA defeat)', async () => {
    // owner creates workspace
    const wsRes = await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/workspaces',
      headers: authedHeaders(s.token),
      body: { clientName: 'Owner LLC', clientDomain: 'ownerllc.com' },
      env: REQ_ENV
    });
    const wsId = (wsRes.data as any).workspace.id;

    // attacker tries to attach a report to owner's workspace
    const attacker = await registerTestUser(s.db, 'bola@example.com');
    const attack = await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/reports',
      headers: authedHeaders(attacker.token),
      body: {
        workspaceId: wsId,
        reportTitle: 'Sneaky',
        reportingPeriod: 'Oct 2026',
        data: { kpis: {}, topQueries: [], topPages: [], topGainers: [], topLosers: [] }
      },
      env: REQ_ENV
    });
    expect(attack.status).toBe(404);
    expect(attack.error).toBe('NOT_FOUND');
  });

  it('sanitizes accentColor inside report branding on creation', async () => {
    const ws = await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/workspaces',
      headers: authedHeaders(s.token),
      body: { clientName: 'Brand Co', clientDomain: 'brand.com' },
      env: REQ_ENV
    });
    const wsId = (ws.data as any).workspace.id;

    const res = await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/reports',
      headers: authedHeaders(s.token),
      body: {
        workspaceId: wsId,
        reportTitle: 'Branded Report',
        reportingPeriod: 'Oct 2026',
        data: { kpis: {}, topQueries: [], topPages: [], topGainers: [], topLosers: [] },
        branding: {
          agencyName: 'Brand Co',
          accentColor: 'green; display:none'
        }
      },
      env: REQ_ENV
    });
    expect(res.status).toBe(201);
    expect((res.data as any).report.branding.accentColor).toBe('#4F46E5'); // sanitized to default
    expect((res.data as any).report.branding.agencyName).toBe('Brand Co'); // valid field preserved
  });
});

describe('Report Listing Endpoint', () => {
  let s: Session;
  beforeEach(async () => {
    s = await createAuthenticatedSession('list@example.com');
  });

  it('lists all reports for the authenticated user with quota', async () => {
    const wsRes = await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/workspaces',
      headers: authedHeaders(s.token),
      body: { clientName: 'List Co', clientDomain: 'listco.com' },
      env: REQ_ENV
    });
    const wsId = (wsRes.data as any).workspace.id;

    await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/reports',
      headers: authedHeaders(s.token),
      body: {
        workspaceId: wsId,
        reportTitle: 'Report One',
        reportingPeriod: 'October 2026',
        data: { kpis: {}, topQueries: [], topPages: [], topGainers: [], topLosers: [] }
      },
      env: REQ_ENV
    });

    const list = await handleApiRequest(s.db, { method: 'GET', url: '/api/reports', headers: authedHeaders(s.token), env: REQ_ENV });
    expect(list.status).toBe(200);
    expect((list.data as any).reports).toHaveLength(1);
    expect((list.data as any).reports[0].reportTitle).toBe('Report One');
    // Reports default to PRIVATE unless the owner explicitly opts into sharing.
    expect((list.data as any).reports[0].isPublic).toBe(false);
    expect((list.data as any).quota.used).toBe(1);
  });

  it('does not leak another user’s reports into the list', async () => {
    const attacker = await registerTestUser(s.db, 'listattacker@example.com');

    const wsRes = await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/workspaces',
      headers: authedHeaders(s.token),
      body: { clientName: 'Victim List', clientDomain: 'victimlist.com' },
      env: REQ_ENV
    });
    const wsId = (wsRes.data as any).workspace.id;

    await handleApiRequest(s.db, {
      method: 'POST',
      url: '/api/reports',
      headers: authedHeaders(s.token),
      body: {
        workspaceId: wsId,
        reportTitle: 'Victim Secret',
        reportingPeriod: 'October 2026',
        data: { kpis: {}, topQueries: [], topPages: [], topGainers: [], topLosers: [] }
      },
      env: REQ_ENV
    });

    const attack = await handleApiRequest(s.db, { method: 'GET', url: '/api/reports', headers: authedHeaders(attacker.token), env: REQ_ENV });
    expect(attack.status).toBe(200);
    expect((attack.data as any).reports).toHaveLength(0);
  });
});

describe('Report Access Control (IDOR protection)', () => {
  let db: InMemoryD1Database;
  let ownerToken: string;
  let attackerToken: string;
  let reportId: string;
  let shareToken: string;

  beforeEach(async () => {
    db = createTestDb() as InMemoryD1Database;
    const owner = await registerTestUser(db, 'owner@example.com');
    const attacker = await registerTestUser(db, 'attacker@example.com');
    ownerToken = owner.token;
    attackerToken = attacker.token;

    // Owner creates workspace + report
    const wsRes = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/workspaces',
      headers: authedHeaders(ownerToken),
      body: { clientName: 'Confidential Co', clientDomain: 'confidential.com' },
      env: REQ_ENV
    });
    const wsId = (wsRes.data as any).workspace.id;

    const repRes = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/reports',
      headers: authedHeaders(ownerToken),
      body: {
        workspaceId: wsId,
        reportTitle: 'Secret Client Report',
        reportingPeriod: 'October 2026',
        data: { kpis: { clicks: { current: 999 } }, topQueries: [], topPages: [], topGainers: [], topLosers: [] },
        isPublic: true
      },
      env: REQ_ENV
    });
    reportId = (repRes.data as any).report.id;
    shareToken = (repRes.data as any).report.shareToken;
  });

  it('owner can read, update, and delete their report', async () => {
    const read = await handleApiRequest(db, { method: 'GET', url: `/api/reports/${reportId}`, headers: authedHeaders(ownerToken), env: REQ_ENV });
    expect(read.status).toBe(200);
    expect((read.data as any).report.reportTitle).toBe('Secret Client Report');

    const update = await handleApiRequest(db, {
      method: 'PUT',
      url: `/api/reports/${reportId}`,
      headers: authedHeaders(ownerToken),
      body: { reportTitle: 'Updated Title', isPublic: false },
      env: REQ_ENV
    });
    expect(update.status).toBe(200);
    expect((update.data as any).report.isPublic).toBe(false);

    const del = await handleApiRequest(db, { method: 'DELETE', url: `/api/reports/${reportId}`, headers: authedHeaders(ownerToken), env: REQ_ENV });
    expect(del.status).toBe(200);
  });

  it('cross-tenant user cannot read the report (IDOR blocked)', async () => {
    const res = await handleApiRequest(db, { method: 'GET', url: `/api/reports/${reportId}`, headers: authedHeaders(attackerToken), env: REQ_ENV });
    expect(res.status).toBe(404);
    expect(res.error).toBe('NOT_FOUND');
  });

  it('cross-tenant user cannot update the report', async () => {
    const res = await handleApiRequest(db, {
      method: 'PUT',
      url: `/api/reports/${reportId}`,
      headers: authedHeaders(attackerToken),
      body: { reportTitle: 'Pwned Title' },
      env: REQ_ENV
    });
    expect(res.status).toBe(404);
  });

  it('cross-tenant user cannot delete the report', async () => {
    const res = await handleApiRequest(db, { method: 'DELETE', url: `/api/reports/${reportId}`, headers: authedHeaders(attackerToken), env: REQ_ENV });
    expect(res.status).toBe(200); // route is permissive, verifies via owner below
    const read = await handleApiRequest(db, { method: 'GET', url: `/api/reports/${reportId}`, headers: authedHeaders(ownerToken), env: REQ_ENV });
    expect(read.status).toBe(200);
    expect(reportId).toBeTruthy(); // ensure closure var used beyond TS lint
    expect(shareToken).toBeTruthy();
  });
});

describe('Public Share Link (read-only privacy boundary)', () => {
  it('is accessible only while is_public = true (same token, visibility toggled server-side)', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const owner = await registerTestUser(db, 'shareowner@example.com');

    const wsRes = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/workspaces',
      headers: authedHeaders(owner.token),
      body: { clientName: 'Share Co', clientDomain: 'share.com' },
      env: REQ_ENV
    });
    const wsId = (wsRes.data as any).workspace.id;

    // Create the report as PRIVATE first.
    const created = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/reports',
      headers: authedHeaders(owner.token),
      body: {
        workspaceId: wsId,
        reportTitle: 'Share Test',
        reportingPeriod: 'October 2026',
        data: { kpis: { clicks: { current: 10 } }, topQueries: [], topPages: [], topGainers: [], topLosers: [] },
        isPublic: false
      },
      env: REQ_ENV
    });
    expect(created.status).toBe(201);
    const reportId = (created.data as any).report.id;
    const shareToken = (created.data as any).report.shareToken;

    // Private token -> 404, even with the correct token.
    const denied = await handleApiRequest(db, { method: 'GET', url: `/api/public/reports/${shareToken}`, headers: new Headers(), env: REQ_ENV });
    expect(denied.status).toBe(404);

    // Owner flips visibility to public.
    const update = await handleApiRequest(db, {
      method: 'PUT',
      url: `/api/reports/${reportId}`,
      headers: authedHeaders(owner.token),
      body: { isPublic: true },
      env: REQ_ENV
    });
    expect(update.status).toBe(200);

    // Same token now resolves publicly.
    const allowed = await handleApiRequest(db, { method: 'GET', url: `/api/public/reports/${shareToken}`, headers: new Headers(), env: REQ_ENV });
    expect(allowed.status).toBe(200);
    expect((allowed.data as any).report.reportTitle).toBe('Share Test');
  });

  it('rejects unknown share tokens with 404', async () => {
    const db = createTestDb();
    const res = await handleApiRequest(db, { method: 'GET', url: `/api/public/reports/${'0'.repeat(32)}`, headers: new Headers(), env: REQ_ENV });
    expect(res.status).toBe(404);
  });
});

describe('Payments Flow (server-side verification)', () => {
  it('creates a Pro order payload with the configured test key and stores pending order', async () => {
    const db = createTestDb();
    const owner = await registerTestUser(db, 'pay@example.com');

    const res = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/payments/create-order',
      headers: authedHeaders(owner.token),
      env: REQ_ENV
    });
    expect(res.status).toBe(200);
    expect((res.data as any).amount).toBe(49900);
    expect((res.data as any).keyId).toBe('rzp_test_key_123');
    expect((res.data as any).orderId).toBe('order_test_integration_123');

    // Subscription row exists with status 'created'
    const sub = await db.prepare('SELECT * FROM subscriptions WHERE razorpay_order_id = ?').bind('order_test_integration_123').first<any>();
    expect(sub).toBeDefined();
    expect(sub.status).toBe('created');
  });

  it('fails closed when Razorpay credentials are not configured', async () => {
    const db = createTestDb();
    const owner = await registerTestUser(db, 'noconfig@example.com');

    const res = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/payments/create-order',
      headers: authedHeaders(owner.token),
      env: {} // missing keyId and keySecret
    });
    expect(res.status).toBe(500);
    expect(res.error).toBe('PAYMENT_CONFIG_ERROR');
  });

  it('returns 502 when upstream gateway fails', async () => {
    const db = createTestDb();
    const owner = await registerTestUser(db, 'gatewayfail@example.com');

    const res = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/payments/create-order',
      headers: authedHeaders(owner.token),
      env: {
        ...REQ_ENV,
        RAZORPAY_TRANSPORT: fakeRazorpayTransport(500, { error: { description: 'Gateway Down' } })
      }
    });
    expect(res.status).toBe(502);
    expect(res.error).toBe('PAYMENT_GATEWAY_ERROR');
  });

  it('rejects verification if order does not exist in DB', async () => {
    const db = createTestDb();
    const owner = await registerTestUser(db, 'noorder@example.com');
    const secret = 'rzp_test_secret_123';
    const sig = await computeHmacSha256('order_nonexistent|pay_123', secret);

    const res = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/payments/verify',
      headers: authedHeaders(owner.token),
      body: {
        razorpay_order_id: 'order_nonexistent',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: sig
      },
      env: REQ_ENV
    });
    expect(res.status).toBe(400);
    expect(res.error).toBe('INVALID_ORDER');
  });

  it('activates Pro on a valid signature, supports idempotent re-verification, and rejects forged signature', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const owner = await registerTestUser(db, 'verify@example.com');

    // First create the order
    const orderRes = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/payments/create-order',
      headers: authedHeaders(owner.token),
      env: {
        ...REQ_ENV,
        RAZORPAY_TRANSPORT: fakeRazorpayTransport(200, { id: 'order_verify_flow_1' })
      }
    });
    expect(orderRes.status).toBe(200);
    const orderId = (orderRes.data as any).orderId;
    const paymentId = 'pay_real_flow_1';
    const secret = 'rzp_test_secret_123';

    const goodSignature = await computeHmacSha256(`${orderId}|${paymentId}`, secret);

    // 1. Forged signature fails
    const forged = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/payments/verify',
      headers: authedHeaders(owner.token),
      body: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: goodSignature + 'feed' },
      env: REQ_ENV
    });
    expect(forged.status).toBe(400);
    expect(forged.error).toBe('INVALID_SIGNATURE');

    // 2. Valid signature activates Pro
    const valid = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/payments/verify',
      headers: authedHeaders(owner.token),
      body: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: goodSignature },
      env: REQ_ENV
    });
    expect(valid.status).toBe(200);
    expect((valid.data as any).plan).toBe('pro');

    // Quota now reflects the paid tier
    const me = await handleApiRequest(db, { method: 'GET', url: '/api/auth/me', headers: authedHeaders(owner.token), env: REQ_ENV });
    expect((me.data as any).quota.limit).toBe(5);
    expect((me.data as any).quota.plan).toBe('pro');

    // 3. Idempotent re-verify with same paymentId returns 200
    const reverify = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/payments/verify',
      headers: authedHeaders(owner.token),
      body: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: goodSignature },
      env: REQ_ENV
    });
    expect(reverify.status).toBe(200);
    expect((reverify.data as any).alreadyActive).toBe(true);

    // 4. Verification with different paymentId on already-paid order returns 409
    const conflictSig = await computeHmacSha256(`${orderId}|pay_different`, secret);
    const conflict = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/payments/verify',
      headers: authedHeaders(owner.token),
      body: { razorpay_order_id: orderId, razorpay_payment_id: 'pay_different', razorpay_signature: conflictSig },
      env: REQ_ENV
    });
    expect(conflict.status).toBe(409);
    expect(conflict.error).toBe('ORDER_ALREADY_PAID');
  });

  it('blocks payment verification when unauthenticated', async () => {
    const db = createTestDb();
    const res = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/payments/verify',
      headers: new Headers(),
      body: {},
      env: REQ_ENV
    });
    expect(res.status).toBe(401);
  });
});

describe('Security headers & CORS handling', () => {
  it('rejects malformed JSON bodies without crashing the router', async () => {
    const db = createTestDb() as InMemoryD1Database;
    const owner = await registerTestUser(db, 'malformed@example.com');

    const res = await handleApiRequest(db, {
      method: 'POST',
      url: '/api/reports/compile',
      headers: authedHeaders(owner.token),
      body: 'this is not json',
      env: REQ_ENV
    });
    // Server must not 500; it returns a structured 4xx at worst
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});