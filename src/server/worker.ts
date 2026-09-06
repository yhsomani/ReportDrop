// Cloudflare Worker Entrypoint with Security Headers & CORS Allowlist
//
// CORS is strictly allowlisted: the `Access-Control-Allow-Origin` header is only
// echoed for the request's own origin (same-origin), the Vite dev-server origin,
// or an origin explicitly listed in env.CORS_ORIGINS. Any other Origin gets no
// allow header, so the browser blocks the cross-origin read. We never reflect
// arbitrary origins (`*` is not used) because credentialed requests with an
// Authorization header require an explicit origin.

import { D1Database } from './db/d1Client.js';
import { handleApiRequest, Env, RequestContext } from './routes/api.js';

// Origins the Vite dev server is served from during local development. These are
// harmless in production (the browser only sends an Origin header from a real
// page), but they keep `npm run dev` + a local worker working without config.
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Content-Security-Policy. `style-src 'unsafe-inline'` is required because the
// app uses inline styles heavily; Razorpay's checkout iframe and logo assets are
// allowed explicitly. Everything else is same-origin only.
const CSP =
  "default-src 'self'; " +
  "script-src 'self' https://checkout.razorpay.com; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: https:; " +
  "font-src 'self' data:; " +
  "connect-src 'self' https://api.razorpay.com; " +
  'frame-src https://api.razorpay.com https://checkout.razorpay.com; ' +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "frame-ancestors 'none'; " +
  'upgrade-insecure-requests';

function buildCorsHeaders(request: Request, env: Env = {}): Record<string, string> {
  const requestOrigin = request.headers.get('Origin');

  let allowed = requestOrigin === null || requestOrigin === undefined ? false : requestOrigin;

  if (allowed) {
    const sameOrigin = new URL(request.url).origin;
    const allowlist = new Set<string>([sameOrigin, ...DEV_ORIGINS]);

    if (env.CORS_ORIGINS) {
      for (const o of env.CORS_ORIGINS.split(',')) {
        const trimmed = o.trim();
        if (trimmed) allowlist.add(trimmed);
      }
    }

    if (!allowlist.has(allowed)) {
      // Origin is not trusted: omit the allow header entirely so the browser
      // blocks the cross-origin response. No `*` reflection.
      allowed = false;
    }
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': CSP
  };

  if (allowed) {
    headers['Access-Control-Allow-Origin'] = allowed;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

function logRequest(request: Request, status: number, durationMs: number, env: Env = {}): void {
  const url = new URL(request.url);
  // One structured JSON line per request. Never log bodies, tokens, or
  // credentials — path, status, and timing only.
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      method: request.method,
      path: url.pathname,
      status,
      ms: Math.round(durationMs),
      env: env.ENVIRONMENT || 'development'
    })
  );
}

export default {
  async fetch(request: Request, env: Env = {}): Promise<Response> {
    const startedAt = Date.now();
    const corsHeaders = buildCorsHeaders(request, env);

    // Preflight OPTIONS handler
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      if (!env.DB) {
        // Fail loudly rather than silently falling back to the in-memory engine
        // in production. A Worker without its D1 binding must not serve fake data.
        const response = new Response(
          JSON.stringify({
            error: 'INSTALLATION_ERROR',
            message: 'Database binding is not configured.'
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
        logRequest(request, 500, Date.now() - startedAt, env);
        return response;
      }

      const db: D1Database = env.DB;
      let body: any = null;

      if (['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            body = await request.json();
          } catch {
            return new Response(
              JSON.stringify({ error: 'BAD_REQUEST', message: 'Malformed JSON payload.' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        }
      }

      const ctx: RequestContext = {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body,
        env
      };

      const result = await handleApiRequest(db, ctx);
      const status = result.status;

      const response = new Response(
        JSON.stringify(result.data ? result.data : { error: result.error, message: result.message }),
        {
          status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
      logRequest(request, status, Date.now() - startedAt, env);
      return response;
    } catch (err: any) {
      // Log the full error server-side for debugging, but never echo internals
      // (SQL, DB messages, stack traces) back to the client.
      console.error('Unhandled Worker Error:', err);
      const response = new Response(
        JSON.stringify({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred. Please try again.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
      logRequest(request, 500, Date.now() - startedAt, env);
      return response;
    }
  }
};
