// Universal D1 Database client with native D1 bindings and in-memory engine support
//
// The in-memory engine is a small SQL-shaped interpreter: it parses the column
// lists of INSERT / SELECT / UPDATE / DELETE statements instead of assuming a
// fixed positional schema, so tests can execute realistic SQL without a native
// SQLite dependency. All lookups that must isolate tenants are handled at the
// query layer (e.g. "WHERE id = ? AND user_id = ?").

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(colName?: string): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[]; success: boolean; error?: string }>;
  run(): Promise<{ success: boolean; meta: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<{ count: number; duration: number }>;
  batch?(statements: D1PreparedStatement[]): Promise<any[]>;
}

// ---------------------------------------------------------------------------
// SQL Parsing Helpers
// ---------------------------------------------------------------------------

interface ParsedSelect {
  kind: 'count' | 'rows';
  table: string;
  columns: string[] | null; // null means '*' (full rows)
  where: WhereClause[] | null;
  orderBy: { column: string; direction: 'asc' | 'desc' } | null;
}

type WhereClause = {
  column: string;
  op: '=' | '!=' | '>' | '>=' | '<' | '<=';
  value: any; // resolved literal or bound parameter
  isParam: boolean;
};

const TABLE_NAMES = ['users', 'sessions', 'workspaces', 'reports', 'subscriptions', 'audit_events', 'rate_limits'];

function keywordIndex(text: string, keywords: string[], from: number): number {
  let idx = -1;
  for (const kw of keywords) {
    const found = text.indexOf(kw, from);
    if (found !== -1 && (idx === -1 || found < idx)) idx = found;
  }
  return idx;
}

function splitTopLevel(text: string, sep: RegExp): string[] {
  // Naive split for the controlled SQL subset used by this app (no subqueries,
  // no nested parentheses around 'and' matches in string literals).
  return text.split(sep);
}

function parseSelect(query: string): ParsedSelect | null {
  const q = query.toLowerCase();

  const fromIdx = q.indexOf(' from ');
  if (fromIdx === -1) return null;

  const selectBody = q.slice(q.indexOf('select ') + 'select '.length, fromIdx).trim();
  const afterFrom = q.slice(fromIdx + ' from '.length);

  const orderIdx = afterFrom.indexOf(' order by ');
  const limitIdx = afterFrom.indexOf(' limit ');
  let tableEnd = keywordIndex(afterFrom, [' where ', ' order by ', ' limit '], 0);
  if (tableEnd === -1) tableEnd = afterFrom.length;
  const table = afterFrom.slice(0, tableEnd).trim();

  if (!TABLE_NAMES.includes(table)) return null;

  // Between tableEnd and order by: WHERE clause
  let whereRaw: string | null = null;
  const whereStart = afterFrom.indexOf(' where ', tableEnd);
  if (whereStart !== -1) {
    const whereEnd = keywordIndex(afterFrom, [' order by ', ' limit '], whereStart + ' where '.length);
    whereRaw = afterFrom.slice(whereStart + ' where '.length, whereEnd === -1 ? afterFrom.length : whereEnd);
  }

  // ORDER BY
  let orderBy: ParsedSelect['orderBy'] = null;
  if (orderIdx !== -1) {
    const orderEnd = limitIdx === -1 ? afterFrom.length : limitIdx;
    const orderRaw = afterFrom.slice(orderIdx + ' order by '.length, orderEnd).trim();
    const parts = orderRaw.split(/\s+/);
    const column = parts[0]?.replace(/,/g, '') ?? '';
    const direction = parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    if (column) orderBy = { column, direction };
  }

  // Resolve where clauses positionally against bound parameters later; here
  // we parse the structure and remember placeholder order.
  const where = whereRaw ? parseWhere(whereRaw) : null;

  // Determine select kind & projected columns
  if (/^count\s*\(\s*\*\s*\)/i.test(selectBody) || /^count\s*\(/i.test(selectBody)) {
    return { kind: 'count', table, columns: null, where, orderBy };
  }

  const columns = selectBody === '*' ? null : selectBody.split(',').map(c => c.trim().replace(/"/g, ''));

  return { kind: 'rows', table, columns, where, orderBy };
}

function parseWhere(whereRaw: string): WhereClause[] {
  const clauses: WhereClause[] = [];
  const parts = splitTopLevel(whereRaw, /\s+and\s+/);
  for (const part of parts) {
    const m = part.trim().match(/^([a-z0-9_."]+)\s*(!=|>=|<=|=|>|<)\s*(.+)$/i);
    if (!m) continue;
    const column = m[1].replace(/["`]/g, '');
    const op = m[2].toLowerCase() as WhereClause['op'];
    const rawValue = m[3].trim();

    if (rawValue === '?') {
      clauses.push({ column, op, value: undefined, isParam: true });
    } else if (/^'.*'$/.test(rawValue)) {
      clauses.push({ column, op, value: rawValue.slice(1, -1), isParam: false });
    } else {
      const num = Number(rawValue);
      clauses.push({ column, op, value: isNaN(num) ? rawValue : num, isParam: false });
    }
  }
  return clauses;
}

function compareValue(rowVal: any, expected: any): boolean {
  if (expected === undefined) return false;
  // Bolean/number-ish equality (e.g. is_public = 1 stored as 1 or true)
  const numExpected = Number(expected);
  const numRow = Number(rowVal);
  const rowNumber = typeof rowVal === 'number' || (typeof rowVal === 'string' && rowVal.trim() !== '' && !isNaN(numRow));
  const expNumber = typeof expected === 'number' || (typeof expected === 'string' && expected.trim() !== '' && !isNaN(numExpected));
  if (rowNumber && expNumber) return numRow === numExpected;
  return String(rowVal) === String(expected);
}

function matchesWhere(row: Record<string, any>, where: WhereClause[] | null, params: any[]): boolean {
  if (!where) return true;
  let p = 0;
  for (const clause of where) {
    const expected = clause.isParam ? params[p++] : clause.value;
    if (clause.op === '=') {
      if (!compareValue(row[clause.column], expected)) return false;
    } else if (clause.op === '!=') {
      if (compareValue(row[clause.column], expected)) return false;
    } else {
      const rowNum = Number(row[clause.column]);
      const expNum = Number(expected);
      if (isNaN(rowNum) || isNaN(expNum)) return false;
      if (clause.op === '>') { if (!(rowNum > expNum)) return false; }
      else if (clause.op === '>=') { if (!(rowNum >= expNum)) return false; }
      else if (clause.op === '<') { if (!(rowNum < expNum)) return false; }
      else if (clause.op === '<=') { if (!(rowNum <= expNum)) return false; }
    }
  }
  return true;
}

interface ParsedWrite {
  table: string;
  columns: string[];
  values: any[]; // resolved values in column order (params substituted)
}

function parseInsert(query: string, params: any[]): ParsedWrite | null {
  const q = query;
  // Production INSERT statements are multi-line template literals, so the
  // column list and VALUES clause must match across newlines ([^)]*, [\s\S]*).
  const m = q.match(/^insert\s+into\s+([a-z0-9_]+)\s*\(([^)]*)\)\s*(?:values|value)?\s*([\s\S]*)$/i);
  if (!m) return null;
  const table = m[1].toLowerCase();
  if (!TABLE_NAMES.includes(table)) return null;

  const columns = m[2].split(',').map(c => c.trim().replace(/[`"]/g, '')).filter(Boolean);
  const placeholders = (m[3].match(/\?/g) || []).length;
  const values = Array.from({ length: placeholders }, (_, i) => params[i]);

  if (columns.length !== values.length) return null;
  return { table, columns, values };
}

interface ParsedUpdate {
  table: string;
  set: { column: string; value: any }[];
  where: WhereClause[] | null;
}

function parseUpdate(query: string, params: any[]): ParsedUpdate | null {
  const normalized = query.replace(/\s+/g, ' ').trim();
  const m = normalized.toLowerCase().match(/^update\s+([a-z0-9_]+)\s+set\s+(.*)$/);
  if (!m) return null;
  const table = m[1];
  if (!TABLE_NAMES.includes(table)) return null;

  const setRaw = m[2];
  const whereIdx = setRaw.toLowerCase().indexOf(' where ');
  const setBody = (whereIdx === -1 ? setRaw : setRaw.slice(0, whereIdx)).trim();
  const whereRaw = whereIdx === -1 ? null : setRaw.slice(whereIdx + ' where '.length);

  const setParts = splitTopLevel(setBody, /\s*,\s*/).map(part => part.trim()).filter(Boolean);
  const resolved: ParsedUpdate['set'] = [];
  let p = 0;
  for (const part of setParts) {
    const sm = part.match(/^([a-z0-9_."]+)\s*=\s*(.+)$/i);
    if (!sm) continue;
    const column = sm[1].replace(/["`]/g, '');
    const rawValue = sm[2].trim();
    const value = rawValue === '?' ? params[p++] : rawValue;
    resolved.push({ column, value });
  }

  const where = whereRaw ? parseWhere(whereRaw.trim()) : null;

  return { table, set: resolved, where };
}

interface ParsedDelete {
  table: string;
  where: WhereClause[] | null;
}

function parseDelete(query: string): ParsedDelete | null {
  const m = query.toLowerCase().match(/^\s*delete\s+from\s+([a-z0-9_]+)\s*(?:where\s+(.*))?$/);
  if (!m) return null;
  const table = m[1];
  if (!TABLE_NAMES.includes(table)) return null;
  const where = m[2] ? parseWhere(m[2]) : null;
  return { table, where };
}

// ---------------------------------------------------------------------------
// In-Memory SQLite Simulator
// ---------------------------------------------------------------------------

export class InMemoryD1Database implements D1Database {
  private tables: Map<string, Map<string, Record<string, any>>> = new Map();

  constructor() {
    this.initTables();
  }

  private initTables() {
    for (const name of TABLE_NAMES) {
      this.tables.set(name, new Map());
    }
  }

  public reset() {
    this.initTables();
  }

  prepare(query: string): D1PreparedStatement {
    return new InMemoryPreparedStatement(this.tables, query);
  }

  async exec(_query: string): Promise<{ count: number; duration: number }> {
    return { count: 0, duration: 0 };
  }

  async batch(statements: D1PreparedStatement[]): Promise<any[]> {
    const results: any[] = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }
}

export async function runBatch(db: D1Database, statements: D1PreparedStatement[]): Promise<any[]> {
  if (db.batch && typeof db.batch === 'function') {
    return db.batch(statements);
  }
  const results: any[] = [];
  for (const stmt of statements) {
    results.push(await stmt.run());
  }
  return results;
}

class InMemoryPreparedStatement implements D1PreparedStatement {
  private tables: Map<string, Map<string, Record<string, any>>>;
  private query: string;
  private boundValues: any[] = [];

  constructor(tables: Map<string, Map<string, Record<string, any>>>, query: string) {
    this.tables = tables;
    this.query = query.trim();
  }

  bind(...values: any[]): D1PreparedStatement {
    this.boundValues = values;
    return this;
  }

  async first<T = any>(colName?: string): Promise<T | null> {
    const res = await this.all<T>();
    if (res.results.length === 0) return null;
    const row = res.results[0];
    if (colName && typeof row === 'object' && row !== null) {
      return (row as any)[colName] ?? null;
    }
    return row;
  }

  async all<T = any>(): Promise<{ results: T[]; success: boolean; error?: string }> {
    try {
      const results = this.executeRead();
      return { results: results as T[], success: true };
    } catch (e: any) {
      return { results: [], success: false, error: e.message };
    }
  }

  async run(): Promise<{ success: boolean; meta: any }> {
    try {
      const meta = this.executeWrite();
      return { success: true, meta };
    } catch (e: any) {
      return { success: false, meta: { error: e.message } };
    }
  }

  // ------------------------- Reads -------------------------

  private executeRead(): any[] {
    const parsed = parseSelect(this.query);
    if (!parsed) return [];

    const table = this.tables.get(parsed.table)!;
    const rows = Array.from(table.values());

    const filtered = rows.filter(row => matchesWhere(row, parsed.where ?? null, this.boundValues));

    if (parsed.kind === 'count') {
      return [{ count: filtered.length }];
    }

    if (parsed.orderBy) {
      const { column, direction } = parsed.orderBy;
      filtered.sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        const cmp = (av ?? 0) > (bv ?? 0) ? 1 : (av ?? 0) < (bv ?? 0) ? -1 : 0;
        return direction === 'desc' ? -cmp : cmp;
      });
    }

    const columns = parsed.columns;
    if (!columns) {
      return filtered;
    }

    // Projection: return only the requested columns (treats scalar selects like
    // `SELECT plan FROM users ...` as `SELECT plan, ... FROM ...`).
    return filtered.map(row => {
      const projected: any = {};
      for (const col of columns) {
        projected[col.trim()] = row[col.trim()];
      }
      return projected;
    });
  }

  // ------------------------- Writes -------------------------

  private executeWrite(): any {
    const insert = parseInsert(this.query, this.boundValues);
    if (insert) return this.applyInsert(insert);

    const update = parseUpdate(this.query, this.boundValues);
    if (update) return this.applyUpdate(update);

    const del = parseDelete(this.query);
    if (del) return this.applyDelete(del);

    return { changes: 0 };
  }

  private applyInsert(parsed: ParsedWrite): any {
    const table = this.tables.get(parsed.table)!;
    const row: Record<string, any> = {};
    parsed.columns.forEach((col, idx) => {
      row[col] = parsed.values[idx];
    });

    // Sessions are keyed by token, rate-limit buckets by their `key` column;
    // all other tables are keyed by id (matching each table's real D1 PK).
    const key =
      parsed.table === 'sessions' ? row.token :
      parsed.table === 'rate_limits' ? row.key :
      row.id;
    if (key === undefined || key === null) return { changes: 0 };

    table.set(String(key), row);
    return { changes: 1 };
  }

  private applyUpdate(parsed: ParsedUpdate): any {
    const table = this.tables.get(parsed.table)!;
    // Placeholders appear SET-first then WHERE in all application queries, so
    // the WHERE parameters are the tail of the bound values.
    const whereParams = this.boundValues.slice(parsed.set.length);
    let changes = 0;
    for (const row of table.values()) {
      if (!row) continue;
      if (!matchesWhere(row, parsed.where, whereParams)) continue;
      for (const set of parsed.set) {
        row[set.column] = set.value;
      }
      changes++;
    }
    return { changes };
  }

  private applyDelete(parsed: ParsedDelete): any {
    const table = this.tables.get(parsed.table)!;
    const removed: string[] = [];
    for (const [key, row] of table.entries()) {
      if (!row) continue;
      if (matchesWhere(row, parsed.where, this.boundValues)) {
        removed.push(key);
      }
    }
    for (const key of removed) {
      table.delete(key);
    }

    // Cascade: deleting a workspace removes its reports too.
    if (parsed.table === 'workspaces' && removed.length > 0) {
      const reports = this.tables.get('reports')!;
      for (const [repKey, rep] of reports.entries()) {
        if (rep && removed.includes(rep.workspace_id)) {
          reports.delete(repKey);
        }
      }
    }

    return { changes: removed.length };
  }
}

// ---------------------------------------------------------------------------
// Global Singleton
// ---------------------------------------------------------------------------

let activeDb: D1Database | null = null;

export function getDatabase(envDb?: D1Database): D1Database {
  if (envDb) return envDb;
  if (!activeDb) {
    activeDb = new InMemoryD1Database();
  }
  return activeDb;
}

export function resetTestDatabase(): void {
  if (activeDb instanceof InMemoryD1Database) {
    activeDb.reset();
  } else {
    activeDb = new InMemoryD1Database();
  }
}