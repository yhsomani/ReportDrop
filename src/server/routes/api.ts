// REST API Request Router & Endpoint Handlers

import { D1Database } from '../db/d1Client.js';
import {
  generateSalt,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  generateShareToken,
  generateId,
  authenticateRequest
} from '../services/auth.js';
import {
  normalizeGSCQueries,
  normalizeGSCPages,
  normalizeGA4Traffic,
  normalizeRankKeywords
} from '../services/normalizer.js';
import { compileReportData } from '../services/kpiEngine.js';
import {
  checkUserQuota,
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  activateSubscription,
  RazorpayApiError
} from '../services/payments.js';
import { checkRateLimit } from '../services/rateLimit.js';
import {
  sanitizeRequiredText,
  sanitizeOptionalText,
  sanitizeShortText,
  sanitizeDomain,
  sanitizeEmail,
  sanitizeLogoUrl
} from '../services/validate.js';

export interface Env {
  DB?: D1Database;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  /** Inject a Razorpay Orders API fetch transport. Test/offline-dev only; the
   *  production Worker always uses the platform `fetch`. */
  RAZORPAY_TRANSPORT?: typeof fetch;
  /** Comma-separated allowlist of origins permitted to make credentialed CORS
   *  requests (the app's own origin and the Vite dev server are always added). */
  CORS_ORIGINS?: string;
  /** Deployment environment label for structured request logging. */
  ENVIRONMENT?: string;
}

export interface RequestContext {
  method: string;
  url: string;
  headers: Headers;
  body?: any;
  env?: Env;
}

export interface ApiResponse<T = any> {
  status: number;
  data?: T;
  error?: string;
  message?: string;
}

function jsonResponse(status: number, data: any): ApiResponse {
  return { status, data };
}

function errorResponse(status: number, error: string, message: string): ApiResponse {
  return { status, error, message };
}

// --------------------------------------------
// Rate limiting (D1-backed; see rateLimit.ts)
// --------------------------------------------
// The auth endpoints are the primary brute-force surface, so they are capped
// per client IP AND per target email. Resource- or money-consuming writes
// (report creation, payment order creation/verification) are capped per
// authenticated user. A single generous global per-IP cap protects every
// endpoint — public share links included — from bursts.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const AUTH_LIMIT_PER_MINUTE = 10;
const USER_ACTION_LIMIT_PER_MINUTE = 10;
const GLOBAL_IP_LIMIT_PER_MINUTE = 120;

/** Best-effort client IP from proxy headers; never trusted for authorization,
 *  only for coarse abuse throttling. */
function getClientIp(ctx: RequestContext): string {
  const cf = ctx.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const fwd = ctx.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0].trim();
    if (first) return first;
  }
  return 'unknown';
}

/** Returns a 429 error response when the key exceeds `limit` in the window,
 *  otherwise null (request may proceed). */
async function rateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowMs: number
): Promise<ApiResponse | null> {
  const { limited, retryAfterSeconds } = await checkRateLimit(db, key, limit, windowMs);
  if (!limited) return null;
  return errorResponse(
    429,
    'RATE_LIMITED',
    `Too many requests. Please try again in ${retryAfterSeconds} seconds.`
  );
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Brand accent colors are rendered into styling context, so a hostile value must
// never survive. Restrict to a strict 6-digit hex and fall back on anything else.
function sanitizeAccentColor(value: unknown, fallback: string): string {
  const v = typeof value === 'string' ? value.trim() : '';
  return HEX_COLOR.test(v) ? v : fallback;
}

function sanitizeBranding(branding: any, defaults: { agencyName?: string; agencyLogo?: string; accentColor?: string }): any {
  if (!branding || typeof branding !== 'object') return { ...defaults };
  return {
    agencyName: typeof branding.agencyName === 'string' && branding.agencyName.trim() ? branding.agencyName.trim() : defaults.agencyName,
    agencyLogo: typeof branding.agencyLogo === 'string' ? branding.agencyLogo : defaults.agencyLogo,
    accentColor: sanitizeAccentColor(branding.accentColor, sanitizeAccentColor(defaults.accentColor, '#4F46E5'))
  };
}

export async function handleApiRequest(db: D1Database, ctx: RequestContext): Promise<ApiResponse> {
  const url = new URL(ctx.url, 'http://localhost');
  const pathname = url.pathname;
  const method = ctx.method.toUpperCase();

  // Global per-IP burst cap — runs before any body work on every endpoint.
  const globalBlock = await rateLimit(
    db,
    `ip:global:${getClientIp(ctx)}`,
    GLOBAL_IP_LIMIT_PER_MINUTE,
    RATE_LIMIT_WINDOW_MS
  );
  if (globalBlock) return globalBlock;

  // Reject non-object bodies defensively (the worker already catches malformed
  // JSON, but direct callers must not be able to sneak a string/array through
  // and be destructured into empty fields).
  if (ctx.body !== undefined && ctx.body !== null) {
    const isPlainObject = typeof ctx.body === 'object' && !Array.isArray(ctx.body);
    if (!isPlainObject) {
      return errorResponse(400, 'BAD_REQUEST', 'Malformed request body: expected a JSON object.');
    }
  }

  // Extract auth token
  const authHeader = ctx.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  // ----------------------------------------------------
  // PUBLIC ENDPOINTS (No auth required)
  // ----------------------------------------------------

  // 1. Public Report View: GET /api/public/reports/:shareToken
  if (method === 'GET' && pathname.startsWith('/api/public/reports/')) {
    const shareToken = pathname.replace('/api/public/reports/', '').trim();
    if (!shareToken) {
      return errorResponse(400, 'BAD_REQUEST', 'Missing share token');
    }

    const reportRow = await db
      .prepare('SELECT * FROM reports WHERE share_token = ? AND is_public = 1')
      .bind(shareToken)
      .first<any>();

    if (!reportRow) {
      return errorResponse(404, 'NOT_FOUND', 'Report not found or private');
    }

    const wsRow = await db
      .prepare('SELECT client_name, client_domain FROM workspaces WHERE id = ?')
      .bind(reportRow.workspace_id)
      .first<{ client_name: string; client_domain: string }>();

    return jsonResponse(200, {
      report: {
        id: reportRow.id,
        reportTitle: reportRow.report_title,
        reportingPeriod: reportRow.reporting_period,
        clientName: wsRow?.client_name || 'Client',
        clientDomain: wsRow?.client_domain || '',
        data: JSON.parse(reportRow.data_json),
        commentary: JSON.parse(reportRow.commentary_json),
        branding: JSON.parse(reportRow.branding_json),
        createdAt: reportRow.created_at
      }
    });
  }

  // 2. Auth: POST /api/auth/register
  if (method === 'POST' && pathname === '/api/auth/register') {
    const ipBlock = await rateLimit(
      db,
      `ip:register:${getClientIp(ctx)}`,
      AUTH_LIMIT_PER_MINUTE,
      RATE_LIMIT_WINDOW_MS
    );
    if (ipBlock) return ipBlock;

    const { email, password, fullName, agencyName } = ctx.body || {};
    if (!email || !password || !fullName) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Email, password, and full name are required.');
    }
    if (password.length < 8) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters long.');
    }

    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'A valid email address is required.');
    }

    const cleanFullName = sanitizeShortText(fullName);
    if (!cleanFullName.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Full name is required and must be 120 characters or fewer.');
    }

    const cleanAgency = sanitizeOptionalText(agencyName, { max: 120 });
    if (!cleanAgency.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Agency name must be 120 characters or fewer.');
    }

    const emailBlock = await rateLimit(
      db,
      `email:register:${cleanEmail.value}`,
      AUTH_LIMIT_PER_MINUTE,
      RATE_LIMIT_WINDOW_MS
    );
    if (emailBlock) return emailBlock;

    const existing = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(cleanEmail.value)
      .first();

    if (existing) {
      return errorResponse(400, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const userId = generateId('usr');
    const now = Date.now();
    const agencyValue = cleanAgency.value || 'My Agency';

    await db
      .prepare(`
        INSERT INTO users (id, email, password_hash, password_salt, full_name, agency_name, agency_logo, accent_color, plan, subscription_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(userId, cleanEmail.value, passwordHash, salt, cleanFullName.value, agencyValue, null, '#4F46E5', 'free', 'inactive', now, now)
      .run();

    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days
    await db
      .prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(sessionToken, userId, expiresAt, now)
      .run();

    return jsonResponse(201, {
      token: sessionToken,
      user: {
        id: userId,
        email: cleanEmail.value,
        fullName: cleanFullName.value,
        agencyName: agencyValue,
        accentColor: '#4F46E5',
        plan: 'free',
        subscriptionStatus: 'inactive'
      }
    });
  }

  // 3. Auth: POST /api/auth/login
  if (method === 'POST' && pathname === '/api/auth/login') {
    const ipBlock = await rateLimit(
      db,
      `ip:login:${getClientIp(ctx)}`,
      AUTH_LIMIT_PER_MINUTE,
      RATE_LIMIT_WINDOW_MS
    );
    if (ipBlock) return ipBlock;

    const { email, password } = ctx.body || {};
    if (!email || !password) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Email and password are required.');
    }

    const cleanEmail = email.trim().toLowerCase();

    const emailBlock = await rateLimit(
      db,
      `email:login:${cleanEmail}`,
      AUTH_LIMIT_PER_MINUTE,
      RATE_LIMIT_WINDOW_MS
    );
    if (emailBlock) return emailBlock;

    const user = await db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(cleanEmail)
      .first<any>();

    if (!user) {
      return errorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const isValid = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!isValid) {
      return errorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const now = Date.now();
    const sessionToken = generateSessionToken();
    const expiresAt = now + (30 * 24 * 60 * 60 * 1000);

    await db
      .prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(sessionToken, user.id, expiresAt, now)
      .run();

    // Sweep this user's expired sessions so revoked/expired tokens accumulate
    // neither in the table nor as a stale login surface.
    await db
      .prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?')
      .bind(user.id, now)
      .run();

    return jsonResponse(200, {
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        agencyName: user.agency_name || 'My Agency',
        agencyLogo: user.agency_logo || undefined,
        accentColor: user.accent_color || '#4F46E5',
        plan: user.plan || 'free',
        subscriptionStatus: user.subscription_status || 'inactive'
      }
    });
  }

  // ----------------------------------------------------
  // PROTECTED ENDPOINTS (Authentication Guard)
  // ----------------------------------------------------
  const user = await authenticateRequest(db, token);
  if (!user) {
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication token is invalid or expired.');
  }

  // Auth: GET /api/auth/me
  if (method === 'GET' && pathname === '/api/auth/me') {
    const quota = await checkUserQuota(db, user.id);
    return jsonResponse(200, { user, quota });
  }

  // Auth: DELETE /api/auth/session (logout — revoke this server-side session)
  if (method === 'DELETE' && pathname === '/api/auth/session') {
    await db
      .prepare('DELETE FROM sessions WHERE token = ?')
      .bind(token)
      .run();
    return jsonResponse(200, { success: true });
  }

  // Auth: PUT /api/auth/profile
  if (method === 'PUT' && pathname === '/api/auth/profile') {
    const { fullName, agencyName, agencyLogo, accentColor } = ctx.body || {};
    const now = Date.now();

    // accentColor is rendered into styling context — only a strict hex may pass.
    const nextAccent = sanitizeAccentColor(accentColor, sanitizeAccentColor(user.accentColor, '#4F46E5'));

    // Optional fields: blank/absent keeps the existing value, but any supplied
    // value is length/format-checked before it can be persisted.
    const cleanFullName = sanitizeOptionalText(fullName, { max: 120 });
    if (!cleanFullName.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Full name must be 120 characters or fewer.');
    }
    const cleanAgencyName = sanitizeOptionalText(agencyName, { max: 120 });
    if (!cleanAgencyName.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Agency name must be 120 characters or fewer.');
    }
    const cleanLogo = sanitizeLogoUrl(agencyLogo);
    if (!cleanLogo.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Agency logo must be a valid http(s) image URL.');
    }

    const nextFullName = cleanFullName.value ?? user.fullName;
    const nextAgencyName = cleanAgencyName.value ?? user.agencyName;
    const nextLogo = cleanLogo.value !== undefined ? cleanLogo.value : (user.agencyLogo || null);

    await db
      .prepare('UPDATE users SET full_name = ?, agency_name = ?, agency_logo = ?, accent_color = ?, updated_at = ? WHERE id = ?')
      .bind(
        nextFullName,
        nextAgencyName,
        nextLogo,
        nextAccent,
        now,
        user.id
      )
      .run();

    return jsonResponse(200, {
      user: {
        ...user,
        fullName: nextFullName,
        agencyName: nextAgencyName,
        agencyLogo: nextLogo,
        accentColor: nextAccent,
        updatedAt: now
      }
    });
  }

  // ----------------------------------------------------
  // WORKSPACES ENDPOINTS
  // ----------------------------------------------------

  // GET /api/workspaces
  if (method === 'GET' && pathname === '/api/workspaces') {
    const rows = await db
      .prepare('SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at DESC')
      .bind(user.id)
      .all<any>();

    const workspaces = (rows.results || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      clientName: r.client_name,
      clientDomain: r.client_domain,
      currency: r.currency || 'USD',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return jsonResponse(200, { workspaces });
  }

  // POST /api/workspaces
  if (method === 'POST' && pathname === '/api/workspaces') {
    const { clientName, clientDomain, currency } = ctx.body || {};

    const cleanClientName = sanitizeShortText(clientName);
    if (!cleanClientName.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Client name is required and must be 120 characters or fewer.');
    }
    const cleanDomain = sanitizeDomain(clientDomain, { max: 200 });
    if (!cleanDomain.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'A valid client domain is required (e.g. example.com).');
    }

    const wsId = generateId('ws');
    const now = Date.now();

    await db
      .prepare('INSERT INTO workspaces (id, user_id, client_name, client_domain, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(wsId, user.id, cleanClientName.value, cleanDomain.value, currency || 'USD', now, now)
      .run();

    return jsonResponse(201, {
      workspace: {
        id: wsId,
        userId: user.id,
        clientName: cleanClientName.value,
        clientDomain: cleanDomain.value,
        currency: currency || 'USD',
        createdAt: now,
        updatedAt: now
      }
    });
  }

  // DELETE /api/workspaces/:id
  if (method === 'DELETE' && pathname.startsWith('/api/workspaces/')) {
    const wsId = pathname.replace('/api/workspaces/', '').trim();
    await db
      .prepare('DELETE FROM workspaces WHERE id = ? AND user_id = ?')
      .bind(wsId, user.id)
      .run();

    return jsonResponse(200, { success: true });
  }

  // ----------------------------------------------------
  // REPORTS ENDPOINTS
  // ----------------------------------------------------

  // POST /api/reports/compile (Preview/Calculate without saving)
  if (method === 'POST' && pathname === '/api/reports/compile') {
    const { gscQueriesCsv, gscPagesCsv, ga4Csv, rankCsv, previousGscCsv, previousGa4Csv } = ctx.body || {};

    const gscQueries = gscQueriesCsv ? normalizeGSCQueries(gscQueriesCsv) : [];
    const gscPages = gscPagesCsv ? normalizeGSCPages(gscPagesCsv) : [];
    const ga4Traffic = ga4Csv ? normalizeGA4Traffic(ga4Csv) : [];
    const rankKeywords = rankCsv ? normalizeRankKeywords(rankCsv) : [];
    const previousGscQueries = previousGscCsv ? normalizeGSCQueries(previousGscCsv) : [];
    const previousGa4Traffic = previousGa4Csv ? normalizeGA4Traffic(previousGa4Csv) : [];

    const compiledData = compileReportData({
      gscQueries,
      gscPages,
      ga4Traffic,
      rankKeywords,
      previousGscQueries,
      previousGa4Traffic
    });

    return jsonResponse(200, { data: compiledData });
  }

  // GET /api/reports
  if (method === 'GET' && pathname === '/api/reports') {
    const rows = await db
      .prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC')
      .bind(user.id)
      .all<any>();

    const reports = (rows.results || []).map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      userId: r.user_id,
      reportTitle: r.report_title,
      reportingPeriod: r.reporting_period,
      shareToken: r.share_token,
      isPublic: r.is_public === 1,
      data: JSON.parse(r.data_json),
      commentary: JSON.parse(r.commentary_json),
      branding: JSON.parse(r.branding_json),
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    const quota = await checkUserQuota(db, user.id);
    return jsonResponse(200, { reports, quota });
  }

  // POST /api/reports (Enforces Quota & Saves)
  if (method === 'POST' && pathname === '/api/reports') {
    const userBlock = await rateLimit(
      db,
      `user:reports:${user.id}`,
      USER_ACTION_LIMIT_PER_MINUTE,
      RATE_LIMIT_WINDOW_MS
    );
    if (userBlock) return userBlock;

    const quota = await checkUserQuota(db, user.id);
    if (!quota.canCreate) {
      return errorResponse(403, 'QUOTA_EXCEEDED', `Report limit reached (${quota.used}/${quota.limit}). Please upgrade to Pro.`);
    }

    const { workspaceId, reportTitle, reportingPeriod, data, commentary, branding, isPublic } = ctx.body || {};
    if (!workspaceId || !reportTitle || !reportingPeriod || !data) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Workspace, title, period, and compiled data are required.');
    }

    const cleanTitle = sanitizeShortText(reportTitle);
    if (!cleanTitle.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Report title must be 120 characters or fewer.');
    }
    const cleanPeriod = sanitizeRequiredText(reportingPeriod, { max: 60 });
    if (!cleanPeriod.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Reporting period must be 60 characters or fewer.');
    }

    // Verify workspace ownership
    const ws = await db
      .prepare('SELECT id FROM workspaces WHERE id = ? AND user_id = ?')
      .bind(workspaceId, user.id)
      .first();

    if (!ws) {
      return errorResponse(404, 'NOT_FOUND', 'Workspace not found or unauthorized.');
    }

    const reportId = generateId('rep');
    const shareToken = generateShareToken();
    const now = Date.now();

    const commentaryJson = JSON.stringify(commentary || {
      whatHappened: '',
      whatWeDid: '',
      whatsNext: ''
    });

    // Client-supplied branding is sanitized (notably accentColor, which is
    // rendered into styling context).
    const brandingJson = JSON.stringify(sanitizeBranding(branding, {
      agencyName: user.agencyName,
      agencyLogo: user.agencyLogo,
      accentColor: user.accentColor
    }));

    await db
      .prepare(`
        INSERT INTO reports (id, workspace_id, user_id, report_title, reporting_period, share_token, is_public, data_json, commentary_json, branding_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        reportId,
        workspaceId,
        user.id,
        cleanTitle.value,
        cleanPeriod.value,
        shareToken,
        // Secure by default: a report is PRIVATE unless the owner explicitly
        // opts into sharing. Public URLs are a privacy boundary for a
        // client-reporting product, so we never publish client data implicitly.
        isPublic === true ? 1 : 0,
        JSON.stringify(data),
        commentaryJson,
        brandingJson,
        'published',
        now,
        now
      )
      .run();

    return jsonResponse(201, {
      report: {
        id: reportId,
        workspaceId,
        reportTitle: cleanTitle.value,
        reportingPeriod: cleanPeriod.value,
        shareToken,
        shareUrl: `/r/${shareToken}`,
        isPublic: isPublic === true,
        data,
        commentary: JSON.parse(commentaryJson),
        branding: JSON.parse(brandingJson),
        createdAt: now,
        updatedAt: now
      }
    });
  }

  // GET /api/reports/:id
  if (method === 'GET' && pathname.startsWith('/api/reports/')) {
    const reportId = pathname.replace('/api/reports/', '').trim();
    const rep = await db
      .prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?')
      .bind(reportId, user.id)
      .first<any>();

    if (!rep) {
      return errorResponse(404, 'NOT_FOUND', 'Report not found or unauthorized.');
    }

    return jsonResponse(200, {
      report: {
        id: rep.id,
        workspaceId: rep.workspace_id,
        userId: rep.user_id,
        reportTitle: rep.report_title,
        reportingPeriod: rep.reporting_period,
        shareToken: rep.share_token,
        isPublic: rep.is_public === 1,
        data: JSON.parse(rep.data_json),
        commentary: JSON.parse(rep.commentary_json),
        branding: JSON.parse(rep.branding_json),
        status: rep.status,
        createdAt: rep.created_at,
        updatedAt: rep.updated_at
      }
    });
  }

  // PUT /api/reports/:id
  if (method === 'PUT' && pathname.startsWith('/api/reports/')) {
    const reportId = pathname.replace('/api/reports/', '').trim();
    const { reportTitle, commentary, branding, isPublic } = ctx.body || {};
    const now = Date.now();

    const existing = await db
      .prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?')
      .bind(reportId, user.id)
      .first<any>();

    if (!existing) {
      return errorResponse(404, 'NOT_FOUND', 'Report not found or unauthorized.');
    }

    // Title is optional here (blank keeps the existing one), but any supplied
    // value is length-checked before it can be persisted.
    const cleanTitle = sanitizeOptionalText(reportTitle, { max: 120 });
    if (!cleanTitle.ok) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Report title must be 120 characters or fewer.');
    }
    const title = cleanTitle.value ?? existing.report_title;
    const commentaryJson = commentary ? JSON.stringify(commentary) : existing.commentary_json;
    const brandingJson = branding
      ? JSON.stringify(sanitizeBranding(branding, JSON.parse(existing.branding_json)))
      : existing.branding_json;
    const pub = isPublic !== undefined ? (isPublic ? 1 : 0) : existing.is_public;

    await db
      .prepare('UPDATE reports SET report_title = ?, commentary_json = ?, branding_json = ?, is_public = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .bind(title, commentaryJson, brandingJson, pub, now, reportId, user.id)
      .run();

    return jsonResponse(200, {
      report: {
        id: reportId,
        workspaceId: existing.workspace_id,
        reportTitle: title,
        reportingPeriod: existing.reporting_period,
        shareToken: existing.share_token,
        isPublic: pub === 1,
        data: JSON.parse(existing.data_json),
        commentary: JSON.parse(commentaryJson),
        branding: JSON.parse(brandingJson),
        status: existing.status,
        createdAt: existing.created_at,
        updatedAt: now
      }
    });
  }

  // DELETE /api/reports/:id
  if (method === 'DELETE' && pathname.startsWith('/api/reports/')) {
    const reportId = pathname.replace('/api/reports/', '').trim();
    await db
      .prepare('DELETE FROM reports WHERE id = ? AND user_id = ?')
      .bind(reportId, user.id)
      .run();

    return jsonResponse(200, { success: true });
  }

  // ----------------------------------------------------
  // PAYMENTS ENDPOINTS (Razorpay)
  // ----------------------------------------------------

  // POST /api/payments/create-order
  if (method === 'POST' && pathname === '/api/payments/create-order') {
    const orderBlock = await rateLimit(
      db,
      `user:payments:${user.id}`,
      USER_ACTION_LIMIT_PER_MINUTE,
      RATE_LIMIT_WINDOW_MS
    );
    if (orderBlock) return orderBlock;

    const keyId = ctx.env?.RAZORPAY_KEY_ID;
    const keySecret = ctx.env?.RAZORPAY_KEY_SECRET;

    // Fail closed: real order creation requires configured gateway credentials.
    // Without them the feature is honestly unavailable, never pretend-working.
    if (!keyId || !keySecret) {
      return errorResponse(500, 'PAYMENT_CONFIG_ERROR', 'Payment processor is not configured.');
    }

    try {
      const order = await createRazorpayOrder(db, {
        userId: user.id,
        plan: 'pro',
        keyId,
        keySecret,
        transport: ctx.env?.RAZORPAY_TRANSPORT
      });
      return jsonResponse(200, order);
    } catch (err) {
      if (err instanceof RazorpayApiError) {
        return errorResponse(err.statusCode, 'PAYMENT_GATEWAY_ERROR', err.message);
      }
      throw err;
    }
  }

  // POST /api/payments/verify
  if (method === 'POST' && pathname === '/api/payments/verify') {
    const verifyBlock = await rateLimit(
      db,
      `user:payments:${user.id}`,
      USER_ACTION_LIMIT_PER_MINUTE,
      RATE_LIMIT_WINDOW_MS
    );
    if (verifyBlock) return verifyBlock;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = ctx.body || {};
    const secret = ctx.env?.RAZORPAY_KEY_SECRET;

    // Fail closed: in any non-test context, a missing secret must never fall
    // back to a default mock string — doing so would allow anyone to forge a
    // signature against the known test secret.
    if (!secret) {
      return errorResponse(500, 'PAYMENT_CONFIG_ERROR', 'Payment processor is not configured.');
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Order id, payment id, and signature are required.');
    }

    // Payment state is derived from the server-stored order, never the client.
    // This order must have been created through us, by this user, at our amount.
    const order = await db
      .prepare('SELECT * FROM subscriptions WHERE razorpay_order_id = ? AND user_id = ?')
      .bind(razorpay_order_id, user.id)
      .first<any>();

    if (!order) {
      return errorResponse(400, 'INVALID_ORDER', 'No pending order was found for this customer.');
    }

    // Idempotent re-delivery of the exact same payment confirmation.
    if (order.status === 'paid' && order.razorpay_payment_id === razorpay_payment_id) {
      return jsonResponse(200, {
        success: true,
        plan: 'pro',
        subscriptionStatus: 'active',
        alreadyActive: true
      });
    }
    // A different payment id on an already-paid order is a conflict we never
    // accept — a single order can only be fulfilled once.
    if (order.status === 'paid') {
      return errorResponse(409, 'ORDER_ALREADY_PAID', 'This order has already been completed.');
    }
    if (order.status !== 'created') {
      return errorResponse(400, 'INVALID_ORDER', 'This order is not in a payable state.');
    }

    const isValid = await verifyRazorpayPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      secret
    );

    if (!isValid) {
      return errorResponse(400, 'INVALID_SIGNATURE', 'Payment signature verification failed.');
    }

    await activateSubscription(db, {
      userId: user.id,
      order,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    return jsonResponse(200, {
      success: true,
      plan: 'pro',
      subscriptionStatus: 'active'
    });
  }

  return errorResponse(404, 'NOT_FOUND', `Endpoint ${method} ${pathname} not found.`);
}
