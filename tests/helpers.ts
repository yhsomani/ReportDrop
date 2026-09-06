// Shared test utilities for ReportDrop test suites

import { InMemoryD1Database, D1Database } from '../src/server/db/d1Client.js';

/**
 * Creates a fresh, isolated in-memory database for each test.
 * Guarantees zero test-to-test state leakage.
 */
export function createTestDb(): D1Database {
  return new InMemoryD1Database();
}

/**
 * Registers a brand-new user and returns the auth token + user id.
 */
export async function registerTestUser(
  db: D1Database,
  email: string,
  password = 'StrongPass123!',
  fullName = 'Test Agency Owner',
  agencyName = 'Test Agency'
): Promise<{ token: string; userId: string }> {
  const { handleApiRequest } = await import('../src/server/routes/api.js');

  const res = await handleApiRequest(db, {
    method: 'POST',
    url: '/api/auth/register',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: { email, password, fullName, agencyName },
    env: {}
  });

  if (res.status >= 400) {
    throw new Error(`registerTestUser failed: ${res.status} ${res.error} - ${res.message}`);
  }

  return {
    token: res.data.token,
    userId: res.data.user.id
  };
}

/**
 * Signs a user in and returns a fresh auth token.
 */
export async function loginTestUser(
  db: D1Database,
  email: string,
  password = 'StrongPass123!'
): Promise<{ token: string; userId: string }> {
  const { handleApiRequest } = await import('../src/server/routes/api.js');

  const res = await handleApiRequest(db, {
    method: 'POST',
    url: '/api/auth/login',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: { email, password },
    env: {}
  });

  if (res.status >= 400) {
    throw new Error(`loginTestUser failed: ${res.status} ${res.error} - ${res.message}`);
  }

  return {
    token: res.data.token,
    userId: res.data.user.id
  };
}

/**
 * Standard GSC Queries CSV fixture for most tests.
 */
export const SAMPLE_GSC_QUERIES_CSV = `Top queries,Clicks,Impressions,CTR,Position
emergency dentist near me,450,3200,14.06%,2.1
teeth whitening cost,310,4100,7.56%,3.4
dental implants specialist,280,2900,9.66%,1.8
root canal symptoms,190,5200,3.65%,4.2
pediatric dentist open saturday,160,1800,8.89%,2.9`;

export const SAMPLE_GSC_PAGES_CSV = `Top pages,Clicks,Impressions,CTR,Position
https://acmedental.com/,820,9500,8.63%,2.4
https://acmedental.com/services/emergency,410,2800,14.64%,1.9
https://acmedental.com/services/implants,290,2600,11.15%,2.1`;

export const SAMPLE_GA4_CSV = `Session default channel group,Users,Sessions,Engaged sessions,Engagement rate,Key events,Event count
Organic Search,1420,1890,1410,74.6%,84,9520
Direct,510,680,480,70.5%,28,2410
Referral,290,360,250,69.4%,19,1650`;

export const SAMPLE_RANK_CSV = `Keyword,Current Position,Previous Position,Search Volume,URL
emergency dentist,2,5,2400,https://acmedental.com/services/emergency
dental implants specialist,1,3,1900,https://acmedental.com/services/implants
teeth whitening clinic,3,7,3200,https://acmedental.com/services/whitening
invisalign provider,5,4,1600,https://acmedental.com/services/invisalign
pediatric dentistry,3,8,1300,https://acmedental.com/services/pediatric`;