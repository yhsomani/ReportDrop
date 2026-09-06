# ReportDrop Deployment Runbook

Deploying ReportDrop to Cloudflare Workers + D1.

## Prerequisites

- `node` + `npm` installed
- `wrangler` (added as a devDependency) — or authenticated `npx wrangler`
- A Cloudflare account with Workers + D1 access
- Authenticated: `npx wrangler login`

## 1. Create the D1 database

```bash
npx wrangler d1 create reportdrop-production
```

The command returns a `database_id` (a UUID). **Copy it** and paste it into
`wrangler.jsonc` under `d1_databases[0].database_id`, replacing the placeholder:

```jsonc
"d1_databases": [{
  "binding": "DB",
  "database_name": "reportdrop-production",
  "database_id": "<PASTE_DATABASE_ID_HERE>",
  "migrations_dir": "migrations"
}]
```

> The placeholder `00000000-0000-0000-0000-000000000000` **must** be replaced
> before any local `wrangler dev` or `wrangler deploy` will work against the real DB.

## 2. Apply migrations

```bash
npx wrangler d1 migrations apply reportdrop-production --remote
```

For a local preview DB (used by `wrangler dev` without `--remote`):

```bash
npx wrangler d1 migrations apply reportdrop-production --local
```

Migrations live in `migrations/` (`0001_initial_schema.sql`,
`0002_payments_rate_limits.sql`) and are kept in sync with
`src/server/db/schema.sql`.

## 3. Set secrets

```bash
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_KEY_ID
```

Secrets are injected at runtime and are never committed or visible in the
deployed bundle. `RAZORPAY_KEY_ID` is a public key and can also live in `vars` /
`wrangler.jsonc` if preferred.

> The payments flow **fails closed** without these keys: `POST
> /api/payments/create-order` returns `500 PAYMENT_CONFIG_ERROR`. This is the
> intended honest behavior — the feature is not pretend-working without
> credentials.

## 3b. (Optional) CORS origins

If the app is served from more than one origin (e.g. an API Worker on a
different hostname from the app), allow the extra origin(s) with the
`CORS_ORIGINS` variable — a comma-separated list. The app's own origin is always
allowed automatically.

```bash
npx wrangler secret put CORS_ORIGINS
# value: https://app.reportdrop.example,https://reports.reportdrop.example
```

Without this, requests from any non-same-origin are blocked by the browser
(no `Access-Control-Allow-Origin` is reflected).

## 4. Build the client

```bash
npm run build
```

Outputs the production client to `dist/`. The Worker serves these files via the
`assets` binding with SPA fallback (`not_found_handling: "single-page-application"`),
and routes every `/api/*` request to the Worker handler.

## 5. Deploy

```bash
npm run worker:deploy
# equivalent to: npx wrangler deploy
```

## 6. Verify

- `GET /` returns the SPA.
- A known `/api/*` route (e.g. `POST /api/auth/register`) responds over HTTPS.
- A report created via the wizard is **not** publicly reachable until the owner
  flips the toggle in the share modal (privacy-by-default).
- `wrangler d1 execute reportdrop-production --remote --command "SELECT count(*) FROM reports;"`
  confirms the DB is populated.

## Rolling back

Workers keep previous deployments:

```bash
npx wrangler versions list
npx wrangler rollback
```

## Environment summary

| Thing | Where |
| --- | --- |
| Worker entrypoint | `src/server/worker.ts` |
| D1 binding | `DB` (see `wrangler.jsonc`) |
| Static assets | `dist/` via `assets` binding |
| Node-compat | `nodejs_compat` flag (crypto.subtle / randomUUID) |
| Secrets | `RAZORPAY_KEY_SECRET`, `RAZORPAY_KEY_ID` (via `wrangler secret put`) |
| CORS allowlist | `CORS_ORIGINS` (comma-separated; app origin always allowed) |
| Production flags | `ENVIRONMENT=production` in `wrangler.jsonc` `vars` |
