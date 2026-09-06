// Development-only API server middleware for Vite.
//
// The production architecture is: a Cloudflare Worker (router in
// src/server/routes/api.ts) in front of a D1 database. `npm run dev` (Vite) has
// no Worker, so this plugin mounts the SAME router over the in-memory D1 engine
// in the Vite dev-server process. Every /api/* request from the browser is a
// real HTTP request into the real router — real validation, rate limiting,
// auth, sessions, and JSON responses. Data survives full page reloads because
// it lives in the dev-server process, not the browser tab.
//
// There is no mock API surface anywhere in the client: the app always talks to
// a real backend over HTTP (the Worker in production, this middleware in dev).

import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { InMemoryD1Database } from './src/server/db/d1Client.js';
import type { D1Database } from './src/server/db/d1Client.js';
import { handleApiRequest } from './src/server/routes/api.js';
import type { RequestContext } from './src/server/routes/api.js';

export function apiDevServerPlugin(): Plugin {
  // One shared database for the whole dev session — like a real D1 binding,
  // rows persist across requests (and page reloads) until the server exits.
  const db: D1Database = new InMemoryD1Database();
  // Secrets read from Vite-resolved .env files exactly like the client's
  // import.meta.env, so dev payments call the real Razorpay API when keys are
  // present and fail closed (PAYMENT_CONFIG_ERROR) when they are not.
  let env: Record<string, string> = {};

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  function toHeaders(req: IncomingMessage): Headers {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    return headers;
  }

  function writeJson(res: ServerResponse, status: number, payload: unknown): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  }

  return {
    name: 'reportdrop-api-dev-server',
    configResolved(config) {
      env = loadEnv(config.mode, config.envDir || process.cwd(), '');
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (!pathname.startsWith('/api/')) return next();

        const method = (req.method || 'GET').toUpperCase();

        // Mirror the Worker's preflight handler.
        if (method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const headers = toHeaders(req);
        const contentType = headers.get('content-type') || '';

        // Mirror the Worker's body parsing: JSON bodies for state-changing
        // verbs, rejected with the same 400 shape when malformed.
        let body: any = undefined;
        if (['POST', 'PUT', 'PATCH'].includes(method) && contentType.includes('application/json')) {
          const raw = await readBody(req).catch(() => '');
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch {
              writeJson(res, 400, { error: 'BAD_REQUEST', message: 'Malformed JSON payload.' });
              return;
            }
          }
        }

        const ctx: RequestContext = {
          method,
          url: `http://${req.headers.host || 'localhost'}${req.url || '/'}`,
          headers,
          body,
          env: {
            DB: db,
            RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
            RAZORPAY_KEY_SECRET: env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET,
            ENVIRONMENT: 'development'
          }
        };

        try {
          const result = await handleApiRequest(db, ctx);
          const payload = result.data ? result.data : { error: result.error, message: result.message };
          writeJson(res, result.status, payload);
        } catch (err) {
          // Same envelope as the Worker's unhandled-error path — never leak
          // internals to the client.
          console.error('[api-dev] unhandled error:', err);
          writeJson(res, 500, { error: 'INTERNAL_ERROR', message: 'Unexpected server error.' });
        }
      });
    }
  };
}