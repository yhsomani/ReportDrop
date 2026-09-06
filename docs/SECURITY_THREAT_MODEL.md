# ReportDrop — Security Threat Model & Security Controls

**Document Version:** 1.0.0  
**Status:** Approved  
**Author:** Principal Security Engineer & Cloudflare Edge Specialist  
**Date:** September 2026  

---

## 1. Threat Model & STRIDE Matrix

| Threat Category | Potential Attack Vector | Impact | Mitigation in ReportDrop |
|---|---|---|---|
| **Spoofing** | Attacker creates fake Razorpay payment notifications or forges auth session tokens | High | Server-side WebCrypto HMAC-SHA256 signature verification for Razorpay orders & webhooks; cryptographically secure 256-bit session tokens; real Razorpay Orders API with server-derived amounts. |
| **Tampering** | CSV Formula Injection (`=HYPERLINK()`, `+cmd|`, `@SUM`) executed in client spreadsheet export | High | Complete client-side & server-side string sanitization. All cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` are sanitized/prefixed. |
| **Repudiation** | User denies performing destructive action or subscription purchase | Medium | Immutable `audit_events` logging for all authentication, report creation/deletion, and payment events. |
| **Information Disclosure** | IDOR / BOLA vulnerability leaking another agency's private client SEO data | Critical | Strict SQL ownership predicates (`WHERE user_id = ?`) derived solely from authenticated session context. Public API only reveals explicit public fields via unguessable 128-bit share tokens. |
| **Denial of Service** | Gigantic multi-gigabyte CSV uploads causing browser/worker memory exhaustion | High | Max file size limit enforced (10MB per file), maximum row count caps (10,000 rows processed per CSV), and stream-safe chunked parsing. |
| **Elevation of Privilege** | Free tier user attempts to generate unlimited reports by tampering with client requests | High | Server-authoritative quota enforcement in D1 transaction before any report insertion. |
| **Brute-Force / Credential Stuffing** | Repeated login/register attempts to guess passwords | Medium | D1-backed sliding-window rate limiting: 10 auth attempts per minute per IP+email, 120 requests per minute per IP globally; `429 RATE_LIMITED` with `Retry-After`. |
| **Cross-Site Scripting / Clickjacking** | Injected scripts via rendered content; iframe embedding of the app | High | Strict Content-Security-Policy (`default-src 'self'`, `script-src 'self'` + Razorpay checkout only, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`); React default escaping; logo URLs restricted to `http(s)`. |
| **Cross-Origin Data Theft** | Malicious origins reading API responses via reflected CORS | High | Strict CORS allowlist: `Access-Control-Allow-Origin` echoes only the same-origin or origins in `CORS_ORIGINS`; arbitrary origins never reflected. HSTS (`max-age=31536000; includeSubDomains`) forces HTTPS. |
| **Session Hijacking / Stale Sessions** | Stolen or never-expiring session tokens | High | Server-side session rows with expiry; `DELETE /api/auth/session` revokes a session server-side; expired sessions swept on every login/register. |

---

## 2. CSV & Data Input Sanitization Rules

### Formula Injection Sanitization
When parsing or rendering any cell string:
```typescript
export function sanitizeCellValue(val: string): string {
  if (typeof val !== 'string') return String(val ?? '');
  const trimmed = val.trim();
  if (['=', '+', '-', '@', '\t', '\r'].some(char => trimmed.startsWith(char))) {
    return `'${trimmed}`; // Prefix with single quote to neutralize formula execution in Excel/Sheets
  }
  return val;
}
```

### XSS Prevention
* All user commentary and branding text is rendered using React's default safe string escaping.
* Agency logo URLs are validated to only allow `https://` protocols or base64 data URIs of type `image/png`, `image/jpeg`, `image/webp`. Raw SVG with executable `<script>` or event handlers is strictly rejected.

---

## 3. Cryptographic & Payment Security

1. **Password Hashing:** PBKDF2 with SHA-256 and 100,000 iterations using standard Web Crypto API.
2. **Session Token Generation:** `crypto.getRandomValues(new Uint8Array(32))` encoded as hex.
3. **Public Share Token Generation:** `crypto.getRandomValues(new Uint8Array(16))` encoded as 32-char hex string (2^128 entropy, brute-force impossible).
4. **Razorpay HMAC Signature Verification:**
   ```typescript
   // Signature verification using Web Crypto API
   const expectedSignature = await hmacSha256(orderId + "|" + paymentId, razorpaySecret);
   if (!timingSafeEqual(expectedSignature, receivedSignature)) {
     throw new Error("Invalid payment signature");
   }
   ```

---
