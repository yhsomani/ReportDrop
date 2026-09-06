# ReportDrop — API Contracts & Endpoint Specifications

**Document Version:** 1.0.0  
**Status:** Approved  
**Author:** Principal API Architect & Backend Engineer  
**Date:** September 2026  

---

## 1. Authentication Scheme

All protected endpoints require an `Authorization: Bearer <session_token>` header or valid session cookie.
* **Token Format:** Cryptographically random 256-bit hexadecimal string or signed JWT.
* **Invalid/Missing Token Response:** `401 Unauthorized` with `{ "error": "UNAUTHORIZED", "message": "Authentication required." }`

---

## 2. API Endpoint Matrix

### 2.1 Auth Endpoints
* **`POST /api/auth/register`**
  * **Request:** `{ "email": "user@example.com", "password": "securePassword123", "fullName": "Jane Doe", "agencyName": "Apex SEO" }`
  * **Response (201):** `{ "token": "...", "user": { "id": "...", "email": "...", "fullName": "...", "plan": "free" } }`
  * **Errors:** `400 Bad Request` (Validation error / email already exists)

* **`POST /api/auth/login`**
  * **Request:** `{ "email": "user@example.com", "password": "securePassword123" }`
  * **Response (200):** `{ "token": "...", "user": { "id": "...", "email": "...", "fullName": "...", "agencyName": "...", "agencyLogo": "...", "accentColor": "...", "plan": "free" } }`
  * **Errors:** `401 Unauthorized` (Invalid credentials)

* **`GET /api/auth/me`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Response (200):** `{ "user": { ... } }`

* **`PUT /api/auth/profile`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Request:** `{ "fullName": "...", "agencyName": "...", "agencyLogo": "...", "accentColor": "#4F46E5" }`
  * **Response (200):** `{ "user": { ... } }`

* **`DELETE /api/auth/session`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Description:** Revokes the current server-side session token (logout). Expired sessions are swept on login/register.
  * **Response (200):** `{ "success": true }`

---

### 2.2 Workspace Endpoints
* **`GET /api/workspaces`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Response (200):** `{ "workspaces": [ { "id": "...", "clientName": "Acme Corp", "clientDomain": "acme.com", "reportCount": 2, "createdAt": 1725600000 } ] }`

* **`POST /api/workspaces`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Request:** `{ "clientName": "Acme Corp", "clientDomain": "acme.com", "currency": "USD" }`
  * **Response (201):** `{ "workspace": { ... } }`

* **`GET /api/workspaces/:id`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Response (200):** `{ "workspace": { ... }, "reports": [ ... ] }`
  * **Errors:** `404 Not Found` / `403 Forbidden` (IDOR check)

* **`PUT /api/workspaces/:id`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Request:** `{ "clientName": "New Acme", "clientDomain": "newacme.com" }`
  * **Response (200):** `{ "workspace": { ... } }`

* **`DELETE /api/workspaces/:id`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Response (200):** `{ "success": true }`

---

### 2.3 Report Endpoints
* **`GET /api/reports`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Response (200):** `{ "reports": [ ... ], "quota": { "used": 1, "limit": 5, "plan": "free" } }`

* **`POST /api/reports`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Request:**
    ```json
    {
      "workspaceId": "ws_123",
      "reportTitle": "August 2026 SEO Performance",
      "reportingPeriod": "August 2026",
      "data": {
        "kpis": {
          "clicks": { "current": 12500, "previous": 10000, "changePercent": 25.0 },
          "impressions": { "current": 350000, "previous": 300000, "changePercent": 16.67 },
          "ctr": { "current": 3.57, "previous": 3.33, "changePercent": 7.21 },
          "avgPosition": { "current": 14.2, "previous": 16.8, "changePercent": -15.48 },
          "organicSessions": { "current": 8400, "previous": 7000, "changePercent": 20.0 }
        },
        "topQueries": [ ... ],
        "topPages": [ ... ],
        "topGainers": [ ... ],
        "topLosers": [ ... ]
      },
      "commentary": {
        "whatHappened": "Organic traffic grew 20% MoM driven by new blog content.",
        "whatWeDid": "Published 4 targeted landing pages and fixed technical crawl errors.",
        "whatsNext": "Expanding backlink outreach and optimizing high-impression keywords."
      },
      "branding": {
        "agencyName": "Apex Digital",
        "agencyLogo": "https://...",
        "accentColor": "#4F46E5"
      },
      "isPublic": false
    }
    ```
  * **Privacy default:** `isPublic` is **optional** and defaults to `false`. A report is
    PRIVATE unless the owner explicitly opts in to sharing (`isPublic: true`).
  * **Response (201):** `{ "report": { "id": "...", "shareToken": "...", "shareUrl": "/r/..." } }`
  * **Errors:** `403 Forbidden` (Quota exceeded: `QUOTA_EXCEEDED`)

* **`GET /api/reports/:id`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Response (200):** `{ "report": { ... } }`
  * **Errors:** `404 Not Found` / `403 Forbidden`

* **`PUT /api/reports/:id`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Request:** `{ "reportTitle": "...", "commentary": { ... }, "branding": { ... }, "isPublic": true }`
    (`isPublic` optional — defaults to `false`, i.e. private.)
  * **Response (200):** `{ "report": { ... } }`

* **`DELETE /api/reports/:id`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Response (200):** `{ "success": true }`

---

### 2.4 Public Client Report Endpoint
* **`GET /api/public/reports/:shareToken`**
  * **Authentication:** None (Public unauthenticated endpoint)
  * **Response (200):**
    ```json
    {
      "report": {
        "reportTitle": "August 2026 SEO Performance",
        "reportingPeriod": "August 2026",
        "data": { ... },
        "commentary": { ... },
        "branding": { ... },
        "createdAt": 1725600000
      }
    }
    ```
  * **Errors:** `404 Not Found` (If report does not exist or `isPublic` is false)

---

### 2.5 Payments Endpoints (Razorpay)
* **`POST /api/payments/create-order`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Request:** `{ "plan": "pro" }`
  * **Description:** Creates a real order via the Razorpay Orders API (`POST https://api.razorpay.com/v1/orders`) and persists a `subscriptions` row in status `created`. The server derives the amount (never the client) and returns Razorpay's real `order_id`.
  * **Response (200):** `{ "orderId": "order_...", "amount": 49900, "currency": "INR", "plan": "pro", "keyId": "rzp_..." }`
  * **Errors:**
    * `500 PAYMENT_CONFIG_ERROR` — Razorpay keys not configured (feature fails closed; no mock).
    * `502 PAYMENT_GATEWAY_ERROR` — Razorpay upstream returned a non-2xx / network failure. No internals leaked.
    * `429 RATE_LIMITED` — exceeded per-user action limit.

* **`POST /api/payments/verify`**
  * **Headers:** `Authorization: Bearer <token>`
  * **Request:** `{ "razorpay_order_id": "...", "razorpay_payment_id": "...", "razorpay_signature": "..." }`
  * **Description:** Verifies the HMAC-SHA256 signature server-side, cross-checks the persisted order row (must exist for this user, status `created`, server-derived amount/currency), then activates the subscription **idempotently** — re-verifying the same payment does not re-extend the period.
  * **Response (200):** `{ "success": true, "plan": "pro", "subscriptionStatus": "active", "alreadyActive": false }`
  * **Errors:** `400 INVALID_ORDER` (order missing/foreign/not in `created` state), `409` (order already paid with a different payment id), `429 RATE_LIMITED`.

* **`POST /api/payments/webhook`**
  * **Headers:** `X-Razorpay-Signature: <hmac_sha256>`
  * **Request Body:** Raw webhook JSON from Razorpay
  * **Response (200):** `{ "status": "ok" }`

---

## 3. Rate Limiting & Global Error Shapes

### 3.1 Rate limiting
D1-backed sliding-window counters (`rate_limits` table):

| Scope | Limit |
| --- | --- |
| Auth (login / register) | 10 / minute per IP + email |
| User actions (report create, verify, create-order) | 10 / minute per user |
| Global | 120 / minute per IP |

When exceeded, the API returns:

```json
HTTP/1.1 429 Too Many Requests
Retry-After: <seconds>

{ "error": "RATE_LIMITED", "message": "Too many requests. Please try again in <seconds> seconds." }
```

### 3.2 Global error shapes
* `400 VALIDATION_ERROR` — malformed or out-of-bounds input (server-side validation).
* `401 UNAUTHORIZED` — missing/invalid session token.
* `403 FORBIDDEN` — tenant/ownership violation, or `QUOTA_EXCEEDED` for report creation.
* `500 PAYMENT_CONFIG_ERROR` — Razorpay keys absent (fail-closed).
* `502 PAYMENT_GATEWAY_ERROR` — Razorpay upstream failure.
* `500 INSTALLATION_ERROR` — Worker deployed without the D1 `DB` binding (fail-loud).

---
