// Unit Tests: Server-side input validation & sanitization helpers

import { describe, it, expect } from 'vitest';
import {
  sanitizeRequiredText,
  sanitizeOptionalText,
  sanitizeShortText,
  sanitizeDomain,
  sanitizeEmail,
  sanitizeLogoUrl
} from '../src/server/services/validate.js';

describe('sanitizeRequiredText', () => {
  it('trims and accepts a non-empty string', () => {
    const res = sanitizeRequiredText('  Hello World  ');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe('Hello World');
  });

  it('rejects non-strings', () => {
    expect(sanitizeRequiredText(123 as unknown).ok).toBe(false);
    expect(sanitizeRequiredText(null).ok).toBe(false);
    expect(sanitizeRequiredText(undefined).ok).toBe(false);
    expect(sanitizeRequiredText({} as unknown).ok).toBe(false);
  });

  it('rejects empty or whitespace-only input', () => {
    expect(sanitizeRequiredText('').ok).toBe(false);
    expect(sanitizeRequiredText('   ').ok).toBe(false);
  });

  it('enforces a max length', () => {
    expect(sanitizeRequiredText('abc', { max: 3 }).ok).toBe(true);
    expect(sanitizeRequiredText('abcd', { max: 3 }).ok).toBe(false);
  });
});

describe('sanitizeOptionalText', () => {
  it('accepts absent and blank values as undefined', () => {
    expect(sanitizeOptionalText(undefined).ok).toBe(true);
    expect(sanitizeOptionalText(null).ok).toBe(true);
    expect(sanitizeOptionalText('').ok).toBe(true);
    expect(sanitizeOptionalText('  ').ok).toBe(true);
  });

  it('validates a supplied value', () => {
    const res = sanitizeOptionalText('  Acme  ', { max: 120 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe('Acme');

    expect(sanitizeOptionalText('x'.repeat(121), { max: 120 }).ok).toBe(false);
    expect(sanitizeOptionalText(42 as unknown, { max: 120 }).ok).toBe(false);
  });
});

describe('sanitizeShortText', () => {
  it('accepts text at or under 120 chars', () => {
    expect(sanitizeShortText('Monthly SEO Report').ok).toBe(true);
    expect(sanitizeShortText('x'.repeat(120)).ok).toBe(true);
  });

  it('rejects text over 120 chars', () => {
    expect(sanitizeShortText('x'.repeat(121)).ok).toBe(false);
  });

  it('rejects empty input', () => {
    expect(sanitizeShortText('').ok).toBe(false);
  });
});

describe('sanitizeDomain', () => {
  it('lowercases and strips scheme/prefixes', () => {
    const res = sanitizeDomain('HTTPS://Example.COM/Path?q=1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe('example.com');
  });

  it('accepts valid hostnames', () => {
    for (const d of ['example.com', 'sub.example.co.uk', 'localhost', 'my-site.io']) {
      expect(sanitizeDomain(d).ok).toBe(true);
    }
  });

  it('rejects invalid hostnames', () => {
    for (const d of ['', '   ', 'not a domain', 'example..com', '-bad.com', 'bad-.com', 'http://']) {
      expect(sanitizeDomain(d).ok).toBe(false);
    }
  });

  it('rejects non-string input', () => {
    expect(sanitizeDomain(123 as unknown).ok).toBe(false);
    expect(sanitizeDomain(null).ok).toBe(false);
  });

  it('enforces a max length', () => {
    expect(sanitizeDomain('a'.repeat(50) + '.com', { max: 20 }).ok).toBe(false);
  });
});

describe('sanitizeEmail', () => {
  it('trims and lowercases a valid email', () => {
    const res = sanitizeEmail('  User@Example.COM  ');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe('user@example.com');
  });

  it('rejects malformed emails', () => {
    for (const e of ['', '   ', 'not-an-email', 'a@b', 'a b@c.com', '@example.com', 'a@']) {
      expect(sanitizeEmail(e).ok).toBe(false);
    }
  });

  it('rejects emails over 254 chars', () => {
    expect(sanitizeEmail(`${'a'.repeat(250)}@example.com`).ok).toBe(false);
  });
});

describe('sanitizeLogoUrl', () => {
  it('accepts absent/blank as undefined', () => {
    expect(sanitizeLogoUrl(undefined).ok).toBe(true);
    expect(sanitizeLogoUrl(null).ok).toBe(true);
    expect(sanitizeLogoUrl('').ok).toBe(true);
  });

  it('accepts http(s) URLs', () => {
    const res = sanitizeLogoUrl('https://cdn.example.com/logo.png');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe('https://cdn.example.com/logo.png');

    expect(sanitizeLogoUrl('http://example.com/logo.png').ok).toBe(true);
  });

  it('rejects non-http URLs and overlong URLs', () => {
    expect(sanitizeLogoUrl('javascript:alert(1)').ok).toBe(false);
    expect(sanitizeLogoUrl('ftp://example.com/logo.png').ok).toBe(false);
    expect(sanitizeLogoUrl('not a url').ok).toBe(false);
    expect(sanitizeLogoUrl(`https://example.com/${'x'.repeat(2048)}`).ok).toBe(false);
  });
});
