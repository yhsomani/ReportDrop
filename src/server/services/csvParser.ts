// Safe CSV Parsing Engine with RFC 4180 Compliance & Formula Injection Sanitization

export interface ParseOptions {
  maxRows?: number;
  delimiter?: string;
  sanitizeFormulas?: boolean;
}

/**
 * Sanitizes a single cell value to prevent CSV Formula Injection in spreadsheets.
 * Neutralizes dangerous leading characters (=, +, @, \t, \r, or formula-like hyphens)
 */
export function sanitizeCellValue(val: string): string {
  if (typeof val !== 'string') return String(val ?? '');
  const trimmed = val.trim();
  if (!trimmed) return '';

  // Check for dangerous leading characters that spreadsheet software interprets as formulas
  const firstChar = trimmed[0];
  if (firstChar === '=' || firstChar === '+' || firstChar === '@' || firstChar === '\t' || firstChar === '\r') {
    return `'${trimmed}`;
  }

  // Hyphen '-' is dangerous if followed by formula syntax or non-numeric tokens (e.g. -2+3 or -cmd)
  if (firstChar === '-') {
    const isStandardNumber = /^-?\d+(\.\d+)?%?$/.test(trimmed);
    if (!isStandardNumber) {
      return `'${trimmed}`;
    }
  }

  return trimmed;
}

/**
 * Automatically detects the most likely CSV delimiter (comma, semicolon, or tab).
 */
export function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const commaCount = (firstLines.match(/,/g) || []).length;
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  const tabCount = (firstLines.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Robust RFC 4180 compliant CSV parser.
 * Handles quoted fields, embedded delimiters, escaped quotes (""), and newlines inside quotes.
 */
export function parseCSV(csvText: string, options: ParseOptions = {}): { headers: string[]; rows: string[][] } {
  const maxRows = options.maxRows ?? 15000;
  const sanitize = options.sanitizeFormulas ?? true;
  const delimiter = options.delimiter ?? detectDelimiter(csvText);

  const cleanText = csvText.replace(/^﻿/, ''); // Strip UTF-8 BOM if present
  if (!cleanText.trim()) {
    return { headers: [], rows: [] };
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;
  const len = cleanText.length;

  while (i < len) {
    const char = cleanText[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < len && cleanText[i + 1] === '"') {
          // Escaped double quote ("")
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        currentRow.push(sanitize ? sanitizeCellValue(currentCell) : currentCell.trim());
        currentCell = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < len && cleanText[i + 1] === '\n') {
          i++; // Skip \n in CRLF
        }
        currentRow.push(sanitize ? sanitizeCellValue(currentCell) : currentCell.trim());
        if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
          rows.push(currentRow);
          if (rows.length >= maxRows) break;
        }
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(sanitize ? sanitizeCellValue(currentCell) : currentCell.trim());
        if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
          rows.push(currentRow);
          if (rows.length >= maxRows) break;
        }
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  // Push final cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(sanitize ? sanitizeCellValue(currentCell) : currentCell.trim());
    if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = rows[0].map(h => h.replace(/^'/, '').trim()); // Clean leading apostrophes on headers
  const dataRows = rows.slice(1);

  return { headers: rawHeaders, rows: dataRows };
}

/**
 * Converts parsed CSV rows into an array of objects keyed by header names.
 */
export function parseCSVToObjects(csvText: string, options: ParseOptions = {}): Record<string, string>[] {
  const { headers, rows } = parseCSV(csvText, options);
  if (headers.length === 0) return [];

  return rows.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? '';
    });
    return obj;
  });
}
