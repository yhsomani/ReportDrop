// Server-side input validation & sanitization.
//
// Every value that crosses the HTTP boundary and is persisted is run through
// these helpers. They are pure and unit-tested: they never touch the network or
// the database, and they return a discriminated union so callers must handle
// the failure branch explicitly (rejecting with 400 VALIDATION_ERROR) rather
// than silently persisting a malformed value.

export type SanitizeResult<T> = { ok: true; value: T } | { ok: false };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HTTP_URL_RE = /^https?:\/\/\S+$/i;

/**
 * A required, non-empty, trimmed text value with an optional max length.
 */
export function sanitizeRequiredText(
  value: unknown,
  opts: { max?: number } = {}
): SanitizeResult<string> {
  if (typeof value !== 'string') return { ok: false };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false };
  if (opts.max !== undefined && trimmed.length > opts.max) return { ok: false };
  return { ok: true, value: trimmed };
}

/**
 * An optional text value: absent/blank is fine (resolves to `undefined`, letting
 * the caller keep the existing value); anything present must pass the same
 * validation as a required field.
 */
export function sanitizeOptionalText(
  value: unknown,
  opts: { max?: number } = {}
): SanitizeResult<string | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value === 'string' && !value.trim()) return { ok: true, value: undefined };
  const res = sanitizeRequiredText(value, opts);
  if (!res.ok) return { ok: false };
  return { ok: true, value: res.value };
}

/**
 * A short required text value (≤ 120 chars) — used for titles and names.
 */
export function sanitizeShortText(value: unknown): SanitizeResult<string> {
  return sanitizeRequiredText(value, { max: 120 });
}

/**
 * A required hostname/domain (e.g. `example.com`, `sub.example.co.uk`,
 * `localhost`). Strips any `http(s)://` prefix and query/fragment, lowercases,
 * and rejects anything that is not a well-formed hostname.
 */
export function sanitizeDomain(value: unknown, opts: { max?: number } = {}): SanitizeResult<string> {
  if (typeof value !== 'string') return { ok: false };
  let host = value.trim().toLowerCase();
  if (!host) return { ok: false };

  // Strip a scheme prefix if the user pasted a full URL.
  host = host.replace(/^https?:\/\//, '');
  // Ignore any path, port, query, or fragment after the host portion.
  host = host.split(/[/?#]/)[0].trim();
  if (!host) return { ok: false };

  if (opts.max !== undefined && host.length > opts.max) return { ok: false };
  if (!HOSTNAME_RE.test(host)) return { ok: false };
  return { ok: true, value: host };
}

/**
 * A required email address: trimmed, lowercased, basic format check, ≤ 254 chars
 * (the RFC 5321 maximum).
 */
export function sanitizeEmail(value: unknown): SanitizeResult<string> {
  if (typeof value !== 'string') return { ok: false };
  const clean = value.trim().toLowerCase();
  if (!clean || clean.length > 254 || !EMAIL_RE.test(clean)) return { ok: false };
  return { ok: true, value: clean };
}

/**
 * An optional logo URL: only `http(s):` URLs up to 2048 chars. A blank/absent
 * value is accepted (resolves to `undefined`); anything present must be a valid
 * http(s) URL — this value is rendered into an `<img src>`.
 */
export function sanitizeLogoUrl(value: unknown): SanitizeResult<string | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value === 'string' && !value.trim()) return { ok: true, value: undefined };
  if (typeof value !== 'string') return { ok: false };
  const url = value.trim();
  if (url.length > 2048 || !HTTP_URL_RE.test(url)) return { ok: false };
  return { ok: true, value: url };
}
