import { getDb, saveDb } from './database';
import type { SqlValue } from 'sql.js';

function toBindParams(params: unknown[]): SqlValue[] {
  return params.map(p => (p === undefined ? null : p) as SqlValue);
}

// Helper to run a SELECT query and return all rows as objects
export function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(toBindParams(params));
  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return results;
}

// Helper to run a SELECT query and return the first row
export function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | undefined {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(toBindParams(params));
  let result: Record<string, unknown> | undefined;
  if (stmt.step()) {
    result = stmt.getAsObject() as Record<string, unknown>;
  }
  stmt.free();
  return result;
}

// Helper to run INSERT/UPDATE/DELETE and auto-save
export function execute(sql: string, params: unknown[] = []): void {
  const db = getDb();
  db.run(sql, toBindParams(params));
  saveDb();
}
