import { describe, expect, it, beforeEach } from 'vitest';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { createClientsStore } from './clients-store';

let db: SqlJsDatabase;

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  // A `clients` tábla séma + a 10 migrált oszlop. Egyetlen CREATE-ben rakjuk
  // össze, hogy ne kelljen a futó alkalmazás migrációs lépéseit reprodukálni.
  db.exec(`
    CREATE TABLE clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      company TEXT DEFAULT '',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      color TEXT DEFAULT '#6366f1',
      tax_number TEXT DEFAULT '',
      representative_name TEXT DEFAULT '',
      postal_code TEXT DEFAULT '',
      city TEXT DEFAULT '',
      street TEXT DEFAULT '',
      address_line2 TEXT DEFAULT '',
      country_code TEXT DEFAULT 'HU',
      eu_vat_number TEXT DEFAULT '',
      preferred_currency TEXT DEFAULT 'HUF',
      invoice_language TEXT DEFAULT 'hu',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
});

function newStore() {
  return createClientsStore({ getDb: () => db, saveDb: () => {} });
}

describe('clientsStore', () => {
  it('üres tábla esetén list() üres tömböt ad', () => {
    expect(newStore().list()).toEqual([]);
  });

  it('create() visszaad egy teljes Client objektumot, alapértelmezésekkel feltöltve', () => {
    const store = newStore();
    const c = store.create({ name: 'Teszt Kft.' });

    expect(c.id).toBeTruthy();
    expect(c.name).toBe('Teszt Kft.');
    expect(c.country_code).toBe('HU');
    expect(c.preferred_currency).toBe('HUF');
    expect(c.invoice_language).toBe('hu');
    expect(c.color).toBe('#6366f1');
    expect(c.created_at).toBeTruthy();
    expect(c.updated_at).toBeTruthy();
  });

  it('byId() visszaadja a létrehozott ügyfelet, ismeretlen id-re null', () => {
    const store = newStore();
    const created = store.create({ name: 'Acme', email: 'hi@acme.com' });

    const fetched = store.byId(created.id);
    expect(fetched?.name).toBe('Acme');
    expect(fetched?.email).toBe('hi@acme.com');

    expect(store.byId('does-not-exist')).toBeNull();
  });

  it('list() név szerint rendez', () => {
    const store = newStore();
    store.create({ name: 'Zeta' });
    store.create({ name: 'Alpha' });
    store.create({ name: 'Mocsok Kft.' });

    expect(store.list().map(c => c.name)).toEqual(['Alpha', 'Mocsok Kft.', 'Zeta']);
  });

  it('update() csak a whitelistelt mezőket frissíti', () => {
    const store = newStore();
    const c = store.create({ name: 'Régi név', email: 'a@b.c' });

    // Tartalmaz egy érvénytelen kulcsot is — a store whitelistnek ki kell szűrnie,
    // különben az UPDATE SQL "no such column" hibára futna.
    const patchWithExtra = {
      name: 'Új név',
      email: 'x@y.z',
      malicious_field: 'hack',
    } as Record<string, unknown>;

    const updated = store.update(c.id, patchWithExtra as Parameters<typeof store.update>[1]);
    expect(updated?.name).toBe('Új név');
    expect(updated?.email).toBe('x@y.z');
  });

  it('update() üres patch esetén is visszaadja a friss állapotot', () => {
    const store = newStore();
    const c = store.create({ name: 'Stabil Kft.' });
    const same = store.update(c.id, {});
    expect(same?.id).toBe(c.id);
    expect(same?.name).toBe('Stabil Kft.');
  });

  it('update() ismeretlen id-re null-t ad', () => {
    expect(newStore().update('ghost-id', { name: 'X' })).toBeNull();
  });

  it('remove() törli az ügyfelet', () => {
    const store = newStore();
    const c = store.create({ name: 'Volt Kft.' });
    expect(store.byId(c.id)).not.toBeNull();
    store.remove(c.id);
    expect(store.byId(c.id)).toBeNull();
  });

  it('EU mezők default értékei: country_code HU, eu_vat_number üres', () => {
    const store = newStore();
    const c = store.create({ name: 'Default ügyfél' });
    expect(c.country_code).toBe('HU');
    expect(c.eu_vat_number).toBe('');
  });

  it('Külföldi ügyfél létrehozása és frissítése country_code/eu_vat_number-rel', () => {
    const store = newStore();
    const c = store.create({
      name: 'Acme GmbH',
      country_code: 'DE',
      eu_vat_number: 'DE123456789',
      preferred_currency: 'EUR',
      invoice_language: 'de',
    });
    expect(c.country_code).toBe('DE');
    expect(c.eu_vat_number).toBe('DE123456789');
    expect(c.preferred_currency).toBe('EUR');
    expect(c.invoice_language).toBe('de');

    const updated = store.update(c.id, { eu_vat_number: 'DE987654321' });
    expect(updated?.eu_vat_number).toBe('DE987654321');
    expect(updated?.country_code).toBe('DE'); // unchanged
  });
});
