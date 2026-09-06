// Unit Tests: CSV Parsing Engine (RFC 4180 compliance, formula injection defense, delimiter detection)

import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  parseCSVToObjects,
  detectDelimiter,
  sanitizeCellValue
} from '../src/server/services/csvParser.js';

describe('detectDelimiter', () => {
  it('detects comma-delimited files', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
  });

  it('detects semicolon-delimited files (European region exports)', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
  });

  it('detects tab-delimited files', () => {
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });
});

describe('sanitizeCellValue (Formula Injection Defense)', () => {
  it('neutralizes leading equals sign (=cmd|...)', () => {
    expect(sanitizeCellValue('=HYPERLINK("http://evil.site")')).toBe("'=HYPERLINK(\"http://evil.site\")");
  });

  it('neutralizes leading plus sign', () => {
    expect(sanitizeCellValue('+cmd|/C calc')).toBe("'+cmd|/C calc");
  });

  it('neutralizes leading at sign', () => {
    expect(sanitizeCellValue('@SUM(1+1)')).toBe("'@SUM(1+1)");
  });

  it('neutralizes a leading tab character', () => {
    // trim() strips the tab; the remaining formula retains its quoting guard.
    const out = sanitizeCellValue('\t=2+3');
    expect(out.startsWith("'")).toBe(true);
    expect(out).not.toContain('\t');
  });

  it('neutralizes a leading CR character', () => {
    // trim() strips the CR; the remaining formula retains its quoting guard.
    const out = sanitizeCellValue('\r=1');
    expect(out.startsWith("'")).toBe(true);
    expect(out).not.toContain('\r');
  });

  it('neutralizes formula-hyphen sequences like -2+3 or -cmd', () => {
    expect(sanitizeCellValue('-2+3')).toBe("'-2+3");
    expect(sanitizeCellValue('-cmd|/C powershell')).toBe("'-cmd|/C powershell");
  });

  it('preserves legitimate negative numbers', () => {
    expect(sanitizeCellValue('-12.5')).toBe('-12.5');
    expect(sanitizeCellValue('-4%')).toBe('-4%');
  });

  it('preserves normal plain text values', () => {
    expect(sanitizeCellValue('organic search')).toBe('organic search');
    expect(sanitizeCellValue('42')).toBe('42');
    expect(sanitizeCellValue('')).toBe('');
  });
});

describe('parseCSV (RFC 4180 Compliance)', () => {
  it('parses simple comma rows with headers', () => {
    const { headers, rows } = parseCSV('Query,Position\nhello,1\nworld,2');
    expect(headers).toEqual(['Query', 'Position']);
    expect(rows).toEqual([['hello', '1'], ['world', '2']]);
  });

  it('handles embedded delimiters inside quoted fields', () => {
    const csv = 'query,note\n"this, has comma","note, inside"';
    const { rows } = parseCSV(csv);
    expect(rows[0][0]).toBe('this, has comma');
    expect(rows[0][1]).toBe('note, inside');
  });

  it('handles escaped double quotes (RFC 4180 "")', () => {
    const csv = 'name,desc\n"Acme ""Dental""","best care"';
    const { rows } = parseCSV(csv);
    expect(rows[0][0]).toBe('Acme "Dental"');
  });

  it('handles embedded newlines inside quoted cells', () => {
    const csv = 'a,b\n"line1\nline2",5';
    const { rows } = parseCSV(csv);
    expect(rows[0][0]).toBe('line1\nline2');
  });

  it('strips UTF-8 BOM', () => {
    const { headers } = parseCSV('﻿a,b\n1,2');
    expect(headers[0]).toBe('a');
  });

  it('returns empty structures for blank input', () => {
    expect(parseCSV('')).toEqual({ headers: [], rows: [] });
    expect(parseCSV('   \n  ')).toEqual({ headers: [], rows: [] });
  });

  it('enforces maxRows cap', () => {
    const csv = 'a\n' + Array.from({ length: 100 }, (_, i) => `${i}`).join('\n');
    const { rows } = parseCSV(csv, { maxRows: 10 });
    expect(rows.length).toBe(10);
  });

  it('hands over the raw rows while sanitizing formula injection', () => {
    const { rows } = parseCSV('a,b\n=1+1,5');
    // Sanitized value should be prefixed with apostrophe
    expect(rows[0][0]).toBe("'=1+1");
  });

  it('does not sanitize when sanitizeFormulas is off', () => {
    const { rows } = parseCSV('a,b\n=1+1,5', { sanitizeFormulas: false });
    expect(rows[0][0]).toBe('=1+1');
  });
});

describe('parseCSVToObjects', () => {
  it('maps header-named columns to object keys', () => {
    const objects = parseCSVToObjects('Query,Clicks\nhello,12\nbye,8');
    expect(objects[0]).toEqual({ Query: 'hello', Clicks: '12' });
    expect(objects[1]).toEqual({ Query: 'bye', Clicks: '8' });
  });

  it('fills missing trailing cells with empty string', () => {
    const objects = parseCSVToObjects('Query,Clicks,CTR\nhello,12');
    expect(objects[0]).toEqual({ Query: 'hello', Clicks: '12', CTR: '' });
  });

  it('returns empty array when there is no header row', () => {
    expect(parseCSVToObjects('')).toEqual([]);
  });
});