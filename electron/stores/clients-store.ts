/**
 * Ügyfél (clients) store — a `clients` tábla domain-tipizált felülete.
 *
 * Az IPC handlerek ide delegálnak. A store kifelé `Client` objektumokat ad át,
 * nem raw SQLite sorokat — így a renderer és a main oldal egy időpontban érvényes,
 * tipusosan ellenőrzött szerződéssel beszélget.
 *
 * Factory pattern: a store függőségei (`getDb`, `saveDb`) kívülről jönnek, így
 * tesztben in-memory sql.js példánnyal hajtható.
 *
 * Felelősségköre **csak a DB-t** érinti. Fájlrendszer mellékhatások (pl. ügyfél-
 * mappa létrehozása / átnevezése) az IPC réteg felelőssége marad — nem
 * domain logika.
 */

import type { Database as SqlJsDatabase, SqlValue } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import type { Client, ClientInput } from '../../shared/types/client';

export interface ClientsStore {
  list(): Client[];
  byId(id: string): Client | null;
  /** Létrehoz egy új ügyfelet, az alapértelmezett mezőkkel feltöltve. */
  create(input: ClientInput): Client;
  /** Whitelist alapján frissíti a megadott mezőket. Ismeretlen kulcsok némán kihagyva. */
  update(id: string, patch: ClientInput): Client | null;
  remove(id: string): void;
}

export interface ClientsStoreDeps {
  getDb: () => SqlJsDatabase;
  /** Lemezre menti az aktuális DB állapotot. Tesztben no-op lehet. */
  saveDb: () => void;
}

const ALLOWED_UPDATE_FIELDS = [
  'name', 'email', 'phone', 'company', 'address', 'postal_code', 'city',
  'street', 'address_line2', 'notes', 'color', 'tax_number',
  'representative_name', 'country_code', 'eu_vat_number',
  'preferred_currency', 'invoice_language',
] as const;

function toBindParams(params: unknown[]): SqlValue[] {
  return params.map(p => (p === undefined ? null : p) as SqlValue);
}

function rowToClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    company: String(row.company ?? ''),
    address: String(row.address ?? ''),
    postal_code: String(row.postal_code ?? ''),
    city: String(row.city ?? ''),
    street: String(row.street ?? ''),
    address_line2: String(row.address_line2 ?? ''),
    tax_number: String(row.tax_number ?? ''),
    representative_name: String(row.representative_name ?? ''),
    country_code: String(row.country_code ?? 'HU'),
    eu_vat_number: String(row.eu_vat_number ?? ''),
    preferred_currency: String(row.preferred_currency ?? 'HUF'),
    invoice_language: String(row.invoice_language ?? 'hu'),
    notes: String(row.notes ?? ''),
    color: String(row.color ?? '#6366f1'),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export function createClientsStore(deps: ClientsStoreDeps): ClientsStore {
  function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
    const stmt = deps.getDb().prepare(sql);
    stmt.bind(toBindParams(params));
    const out: Record<string, unknown>[] = [];
    while (stmt.step()) out.push(stmt.getAsObject() as Record<string, unknown>);
    stmt.free();
    return out;
  }

  function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | null {
    const stmt = deps.getDb().prepare(sql);
    stmt.bind(toBindParams(params));
    const row = stmt.step() ? (stmt.getAsObject() as Record<string, unknown>) : null;
    stmt.free();
    return row;
  }

  function exec(sql: string, params: unknown[] = []): void {
    deps.getDb().run(sql, toBindParams(params));
    deps.saveDb();
  }

  return {
    list(): Client[] {
      return queryAll('SELECT * FROM clients ORDER BY name ASC').map(rowToClient);
    },

    byId(id: string): Client | null {
      const row = queryOne('SELECT * FROM clients WHERE id = ?', [id]);
      return row ? rowToClient(row) : null;
    },

    create(input: ClientInput): Client {
      const id = uuidv4();
      exec(
        `INSERT INTO clients (
          id, name, email, phone, company, address, postal_code, city, street,
          address_line2, tax_number, country_code, eu_vat_number,
          preferred_currency, invoice_language, notes, color
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.name ?? '',
          input.email ?? '',
          input.phone ?? '',
          input.company ?? '',
          input.address ?? '',
          input.postal_code ?? '',
          input.city ?? '',
          input.street ?? '',
          input.address_line2 ?? '',
          input.tax_number ?? '',
          input.country_code ?? 'HU',
          input.eu_vat_number ?? '',
          input.preferred_currency ?? 'HUF',
          input.invoice_language ?? 'hu',
          input.notes ?? '',
          input.color ?? '#6366f1',
        ],
      );
      const row = queryOne('SELECT * FROM clients WHERE id = ?', [id]);
      if (!row) throw new Error(`Failed to read back created client ${id}`);
      return rowToClient(row);
    },

    update(id: string, patch: ClientInput): Client | null {
      const filtered: Record<string, unknown> = {};
      for (const key of ALLOWED_UPDATE_FIELDS) {
        if (key in patch) filtered[key] = (patch as Record<string, unknown>)[key];
      }
      const fields = Object.keys(filtered);
      if (fields.length > 0) {
        const setClause = fields.map(k => `${k} = ?`).join(', ');
        exec(
          `UPDATE clients SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
          [...fields.map(k => filtered[k]), id],
        );
      }
      const row = queryOne('SELECT * FROM clients WHERE id = ?', [id]);
      return row ? rowToClient(row) : null;
    },

    remove(id: string): void {
      exec('DELETE FROM clients WHERE id = ?', [id]);
    },
  };
}
