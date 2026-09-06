# ReportDrop

Privacy-first SEO client report compiler. Converts raw CSV exports from **Google Search Console** (Queries, Pages), **GA4** (Traffic Acquisition), and **keyword rank trackers** (SEMrush / Ahrefs / SE Ranking) into branded, executive-ready monthly client reports.

ReportDrop is built for SEO agencies that want to stop assembling client reports by hand — and stop shipping raw, overwhelming data dumps. Upload your exports, pick the story, and ship a clean, on-brand report your client can actually read.

---

## Why "privacy-first"

Client SEO data is sensitive. ReportDrop is architected around a hard rule:

> **A report is PRIVATE by default.** It is never published unless the owner explicitly opts in to sharing. Public share links are unguessable 128-bit tokens, are strictly read-only, and never leak surrounding tenant data.

This is a deliberate inversion of the "public by default" mistake common in reporting tools. Every schema default, API branch, and test asserts this.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + TypeScript (strict) + TailwindCSS + Lucide |
| Backend | Cloudflare Workers (ES Modules router) |
| Database | Cloudflare D1 (SQLite), bound as `DB` |
| Auth | Server-side sessions; PBKDF2-SHA256 (100k) password hashing via WebCrypto |
| Payments | Razorpay (server-side HMAC-SHA256 signature verification, real Orders API) |
| Rate Limiting | D1-backed sliding-window counters (auth 10/min per IP, global 120/min per IP) |
| Test | Vitest 3 + @vitest/coverage-v8; Playwright (e2e, full real-stack lifecycle) |
| Deploy | Wrangler (`wrangler.jsonc`) + D1 migrations |

In development the Vite dev server mounts the production API router over an in-memory database (`vite-api-dev.ts`), so the full product works end-to-end with zero external services. In production, the Cloudflare Worker serves the same router against D1.

---

## Repository layout

```
migrations/             D1 SQL migrations (0001_initial_schema.sql)
docs/                   BRD, PRD, user flows, DB design, API spec,
                        security threat model, test strategy, implementation plan
src/
  server/
    worker.ts           Cloudflare Worker entrypoint (CORS, routing, error handling)
    routes/api.ts       All API routes + auth guard + tenant scoping
    services/           auth.ts, payments.ts, kpiEngine.ts, normalizer.ts
    db/                 schema.sql, d1Client.ts (in-memory SQL interpreter)
  client/
    main.tsx, App.tsx
    pages/              Dashboard, ReportWizard, ReportView, Login, Register, ...
    components/         ShareReportModal, KPI cards, charts, ...
    context/            AuthContext
    services/           api.ts
tests/                  Vitest integration & unit suites (8 files)
wrangler.jsonc          Cloudflare Workers + D1 + static-asset config
vite.config.ts          Vite + Vitest config
```

---

## Quickstart (local)

```bash
# Install dependencies
npm install

# Run the dev server (Vite, port 3000)
npm run dev

# Run the full test suite
npm test

# Run with coverage
npm run test:coverage

# Type-check without emitting
npx tsc --noEmit

# End-to-end (full real-stack lifecycle) — requires one-time browser install
npx playwright install chromium
npm run test:e2e
```

In local/dev the Vite dev server hosts the same production API router via a middleware (`vite-api-dev.ts`), so the full product (auth, workspaces, report compilation, sharing, payments) works end-to-end with zero external services and no mock data.

> **Note:** Razorpay payments require real credentials (`RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`) even in development. Without them, `POST /api/payments/create-order` returns `PAYMENT_CONFIG_ERROR` (honest fail-closed). Sample data loading and demo login buttons are dev-only and tree-shaken from production builds.

---

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Keys never committed:

| Variable | Purpose |
| --- | --- |
| `RAZORPAY_KEY_ID` | Razorpay public key — required for the payments flow |
| `RAZORPAY_KEY_SECRET` | Razorpay secret — required; set via `wrangler secret put` in production |
| `CORS_ORIGINS` | Comma-separated additional origins for CORS (app origin always allowed) |
| `ENVIRONMENT` | `development` \| `production` |
| `VITE_API_URL` | Client-side API base URL — blank for same-origin (default) |

The D1 binding and `DB` name are configured in `wrangler.jsonc`, not env vars.

---

## Security model

The backend is authoritative. It never trusts client-supplied identity, ownership, pricing, access level, or file metadata. Highlights:

- **Server-side sessions** — identity is established by the server from a session token; the client never self-reports auth state. Sessions can be revoked via `DELETE /api/auth/session`; expired sessions are swept on every login/register.
- **Tenant isolation** — every workspace/report query is scoped `WHERE ... AND user_id = ?`; cross-tenant access returns 403.
- **Private-by-default reports** — created private unless the owner explicitly opts in (`isPublic === true`).
- **Read-only public share** — `GET /api/public/reports/:shareToken` only succeeds for `is_public = 1`, returns only report data, and lives **before** the auth guard (it's a share link, not an authed page).
- **Password handling** — PBKDF2-SHA256, 100k iterations, per-user random salt, constant-time comparison. No plaintext, no reversible storage.
- **Payment integrity** — amount is server-authoritative (hardcoded 49,900 paise for Pro, never read from the client); success requires a valid Razorpay HMAC-SHA256 signature over `orderId|paymentId`. Order creation hits the real Razorpay Orders API; the feature is unavailable without credentials.
- **CORS allowlist** — the Worker reflects only the request origin if it matches the same-origin or is in `CORS_ORIGINS`; arbitrary origins are never echoed.
- **Content-Security-Policy** — strict CSP blocks inline scripts, restricts `script-src` to `'self'` + Razorpay checkout, restricts `frame-src` to Razorpay, and sets `frame-ancestors: 'none'`. HSTS (`max-age=31536000; includeSubDomains`) enforced on every response.
- **Rate limiting** — D1-backed sliding-window counters: 10 auth attempts per minute per IP+email, 120 requests per minute per IP globally. Returns `429 RATE_LIMITED` with `Retry-After`.
- **Input validation** — all user-supplied text (names, domains, URLs, emails) is server-side sanitized with length caps; logo URLs are restricted to `http(s)` schemes ≤ 2048 chars.
- **Defense-in-depth headers** — `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`; generic 500 responses never leak internal error messages.

The full threat model lives in [`docs/SECURITY_THREAT_MODEL.md`](docs/SECURITY_THREAT_MODEL.md).

### Known limitations (tracked, not hidden)

- **Real Razorpay Orders API** — order creation and signature verification are fully implemented against the live Razorpay API. The feature fails closed (`PAYMENT_CONFIG_ERROR`) when `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are not set — the feature is not pretend-working without credentials.
- **`database_id` placeholder** — `wrangler.jsonc` contains `00000000-0000-0000-0000-000000000000` until you run `wrangler d1 create reportdrop-production` and paste the real UUID. `wrangler dev` and production deploys will fail until this is set.
- **Demo-login and sample data** are dev-only — the `import.meta.env.DEV` gates ensure they are tree-shaken from production builds. In production, users upload real CSV exports.
- **MoM deltas** — the report wizard supports optional previous-period CSV uploads (GSC Queries, GA4 Channels) for automatic Month-over-Month delta calculations. When previous-period data is omitted, deltas default to honest baseline indicators and the commentary notes that prior-period baseline was not provided.
- **E2E tests require a one-time browser download**: `npx playwright install chromium`.

---

## Database & migrations

Schema lives in two places kept in sync:

- `src/server/db/schema.sql` — canonical schema used by the in-memory engine.
- `migrations/` — D1 migrations applied against the real database (`0001_initial_schema.sql`, `0002_payments_rate_limits.sql`).

Apply migrations to D1:

```bash
npx wrangler d1 migrations apply reportdrop-production --remote
```

See [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) for full table specs.

---

## Deployment

1. Create the D1 database: `npx wrangler d1 create reportdrop-production`, then paste the returned **database_id** into `wrangler.jsonc` (currently a placeholder).
2. Apply migrations: `npx wrangler d1 migrations apply reportdrop-production --remote`.
3. Set secrets: `npx wrangler secret put RAZORPAY_KEY_SECRET` and set `RAZORPAY_KEY_ID` (via `wrangler secret put RAZORPAY_KEY_ID` or `vars`). Payments fail closed without these.
4. Optionally set `CORS_ORIGINS` (comma-separated) if the app is served from more than one origin.
5. Build the client: `npm run build` (outputs to `dist/`).
6. Deploy: `npm run worker:deploy`.

Static assets are served by the Worker via the `assets` binding with SPA fallback; all `/api/*` requests route to the Worker handler.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full runbook.

---

## Documentation

- [`docs/BRD.md`](docs/BRD.md) — business requirements
- [`docs/PRD.md`](docs/PRD.md) — product requirements
- [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md) — UX flows
- [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) — schema & indexing
- [`docs/API_SPECIFICATION.md`](docs/API_SPECIFICATION.md) — endpoint contracts
- [`docs/SECURITY_THREAT_MODEL.md`](docs/SECURITY_THREAT_MODEL.md) — threats & mitigations
- [`docs/TEST_STRATEGY.md`](docs/TEST_STRATEGY.md) — testing approach & coverage
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — phased plan

---

## License

Private / proprietary. © 2026.
