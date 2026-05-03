import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { HIPA_RATES } from './hipa-data';
import { app } from 'electron';

let db: SqlJsDatabase | null = null;
let dbPath: string | null = null;
let currentUserId: string | null = null;

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. User must be logged in.');
  }
  return db;
}

export function saveDb() {
  if (!db || !dbPath) {
    throw new Error('Database not initialized. User must be logged in.');
  }
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export async function initDatabase(userId: string) {
  // Close any existing database first
  if (db) {
    closeDatabase();
  }

  // Check for legacy klient.db and migrate it to user-scoped file
  const legacyDbPath = path.join(app.getPath('userData'), 'klient.db');
  const userDbPath = path.join(app.getPath('userData'), `klient-${userId}.db`);

  if (fs.existsSync(legacyDbPath) && !fs.existsSync(userDbPath)) {
    console.log(`[Database] Migrating legacy klient.db to klient-${userId}.db`);
    fs.renameSync(legacyDbPath, userDbPath);
  }

  dbPath = userDbPath;
  currentUserId = userId;

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  createTables();
  runMigrations();
  saveDb();

  console.log(`[Database] Initialized database for user ${userId}`);
}

export async function switchDatabase(userId: string) {
  console.log(`[Database] Switching to database for user ${userId}`);
  await initDatabase(userId);
}

export function closeDatabase() {
  if (db) {
    try {
      saveDb();
      db.close();
      console.log(`[Database] Closed database for user ${currentUserId}`);
    } catch (err) {
      console.error('[Database] Error closing database:', err);
    }
    db = null;
    dbPath = null;
    currentUserId = null;
  }
}

function createTables() {
  if (!db) throw new Error('Database not initialized');
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      address TEXT,
      notes TEXT,
      color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on_hold', 'cancelled')),
      deadline TEXT,
      estimated_hours REAL NOT NULL,
      allocated_hours REAL DEFAULT 0,
      is_hours_distributed INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      duration_hours REAL,
      type TEXT DEFAULT 'work' CHECK(type IN ('work', 'meeting', 'deadline', 'reminder', 'other')),
      color TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      client_id TEXT,
      title TEXT,
      content TEXT NOT NULL,
      date TEXT DEFAULT (date('now')),
      is_notification INTEGER DEFAULT 0,
      notification_email TEXT,
      notification_sent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      project_id TEXT,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      duration_seconds REAL,
      transcription TEXT,
      ai_summary TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS shortcuts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      client_id TEXT NOT NULL,
      file_path TEXT,
      invoice_number TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'HUF',
      issue_date TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue', 'cancelled')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      signed_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      invoice_platform TEXT DEFAULT 'none',
      onboarding_complete INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'HUF',
      category TEXT DEFAULT 'other',
      type TEXT DEFAULT 'subscription' CHECK(type IN ('subscription', 'investment')),
      frequency TEXT DEFAULT 'monthly' CHECK(frequency IN ('monthly', 'yearly', 'one-time')),
      start_date TEXT,
      end_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT,
      hourly_rate REAL,
      employment_type TEXT DEFAULT 'employee' CHECK(employment_type IN ('employee', 'contractor', 'freelancer')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_assignments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      team_member_id TEXT NOT NULL,
      assigned_at TEXT DEFAULT (datetime('now')),
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
      UNIQUE(project_id, team_member_id)
    );

    CREATE TABLE IF NOT EXISTS tax_business_types (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_hu TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tax_rules (
      id TEXT PRIMARY KEY,
      business_type TEXT NOT NULL,
      year INTEGER NOT NULL,
      rate_percent REAL NOT NULL,
      rate_label TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (business_type, year, rate_label),
      FOREIGN KEY (business_type) REFERENCES tax_business_types(id)
    );

    CREATE TABLE IF NOT EXISTS tax_eligibility_criteria (
      id TEXT PRIMARY KEY,
      business_type TEXT NOT NULL,
      year INTEGER NOT NULL,
      max_revenue_huf INTEGER,
      max_employees INTEGER,
      conditions_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (business_type, year),
      FOREIGN KEY (business_type) REFERENCES tax_business_types(id)
    );

    CREATE TABLE IF NOT EXISTS tax_calculations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_type TEXT NOT NULL,
      year INTEGER NOT NULL,
      revenue REAL NOT NULL,
      expenses REAL DEFAULT 0,
      tax_amount REAL NOT NULL,
      calculation_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_type) REFERENCES tax_business_types(id)
    );

    CREATE TABLE IF NOT EXISTS user_tax_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_type TEXT NOT NULL,
      year INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (user_id, year),
      FOREIGN KEY (business_type) REFERENCES tax_business_types(id)
    );

    CREATE TABLE IF NOT EXISTS kiva_periods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL CHECK(quarter BETWEEN 1 AND 4),
      auto_personal_payments_huf REAL NOT NULL DEFAULT 0,
      manual_personal_payments_huf REAL,
      personal_payments_mode TEXT NOT NULL DEFAULT 'auto' CHECK(personal_payments_mode IN ('auto', 'manual', 'auto_plus_manual')),
      calculated_base_huf REAL NOT NULL DEFAULT 0,
      calculated_tax_huf REAL NOT NULL DEFAULT 0,
      completeness TEXT NOT NULL DEFAULT 'partial' CHECK(completeness IN ('missing', 'partial', 'complete')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, year, quarter)
    );

    CREATE TABLE IF NOT EXISTS kiva_adjustments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER CHECK(quarter BETWEEN 1 AND 4),
      type TEXT NOT NULL CHECK(type IN ('AAN', 'AACS')),
      category TEXT NOT NULL,
      amount_huf REAL NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kiva_settings (
      user_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      include_external_fees_by_default INTEGER NOT NULL DEFAULT 0,
      manual_note TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, year)
    );

    CREATE TABLE IF NOT EXISTS tax_parameters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL UNIQUE,
      minimalber_havi REAL NOT NULL,
      garantalt_berminimum_havi REAL NOT NULL,
      szja_kulcs REAL NOT NULL,
      tb_kulcs REAL NOT NULL,
      szocho_kulcs REAL NOT NULL,
      tao_kulcs REAL NOT NULL,
      kiva_kulcs REAL NOT NULL,
      aam_limit REAL NOT NULL,
      atalany_altalanos REAL NOT NULL,
      atalany_specialis REAL NOT NULL,
      atalany_kisker REAL NOT NULL,
      atalany_limit_szorzo REAL NOT NULL DEFAULT 10,
      atalany_adomentes_szorzo REAL NOT NULL DEFAULT 0.5,
      szocho_plafon_szorzo REAL NOT NULL DEFAULT 24,
      hipa_max_kulcs REAL NOT NULL DEFAULT 0.02,
      afa_standard REAL NOT NULL DEFAULT 0.27,
      afa_reduced REAL NOT NULL DEFAULT 0.18,
      afa_super_reduced REAL NOT NULL DEFAULT 0.05,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS business_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      vallalkozas_tipus TEXT NOT NULL CHECK(vallalkozas_tipus IN ('EV', 'Kft', 'Bt', 'Kkt')),
      adozas_forma TEXT NOT NULL CHECK(adozas_forma IN ('atalany', 'vszja', 'TAO', 'KIVA')),
      foglalkozas TEXT NOT NULL DEFAULT 'fofoglalkozasu' CHECK(foglalkozas IN ('fofoglalkozasu', 'mellekfoglalkozasu')),
      koltseghanyad REAL NOT NULL DEFAULT 0.45,
      szakkepzettseg INTEGER NOT NULL DEFAULT 0,
      aam_valasztott INTEGER NOT NULL DEFAULT 0,
      afa_bevallas TEXT DEFAULT 'negyedeves' CHECK(afa_bevallas IN ('havi', 'negyedeves', 'eves')),
      hipa_kulcs REAL DEFAULT 0,
      hipa_telepules TEXT DEFAULT '',
      hipa_egyszeru INTEGER NOT NULL DEFAULT 0,
      adoev INTEGER NOT NULL DEFAULT 2026,
      beallitva INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hipa_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      megye TEXT NOT NULL,
      telepules TEXT NOT NULL,
      kulcs REAL NOT NULL,
      UNIQUE(megye, telepules)
    );
  `);
}

function ensureClientInvoiceColumns() {
  if (!db) throw new Error('Database not initialized');

  const clientCols = db.exec("PRAGMA table_info(clients)");
  const clientColNames = clientCols[0]?.values.map(row => row[1]) || [];
  if (!clientColNames.includes('tax_number')) {
    db.run("ALTER TABLE clients ADD COLUMN tax_number TEXT DEFAULT ''");
  }
  if (!clientColNames.includes('representative_name')) {
    db.run("ALTER TABLE clients ADD COLUMN representative_name TEXT DEFAULT ''");
  }
  if (!clientColNames.includes('postal_code')) {
    db.run("ALTER TABLE clients ADD COLUMN postal_code TEXT DEFAULT ''");
  }
  if (!clientColNames.includes('city')) {
    db.run("ALTER TABLE clients ADD COLUMN city TEXT DEFAULT ''");
  }
  if (!clientColNames.includes('street')) {
    db.run("ALTER TABLE clients ADD COLUMN street TEXT DEFAULT ''");
  }
  if (!clientColNames.includes('address_line2')) {
    db.run("ALTER TABLE clients ADD COLUMN address_line2 TEXT DEFAULT ''");
  }
  if (!clientColNames.includes('country_code')) {
    db.run("ALTER TABLE clients ADD COLUMN country_code TEXT DEFAULT 'HU'");
  }
  if (!clientColNames.includes('eu_vat_number')) {
    db.run("ALTER TABLE clients ADD COLUMN eu_vat_number TEXT DEFAULT ''");
  }
  if (!clientColNames.includes('preferred_currency')) {
    db.run("ALTER TABLE clients ADD COLUMN preferred_currency TEXT DEFAULT 'HUF'");
  }
  if (!clientColNames.includes('invoice_language')) {
    db.run("ALTER TABLE clients ADD COLUMN invoice_language TEXT DEFAULT 'hu'");
  }
}

function runMigrations() {
  if (!db) throw new Error('Database not initialized');

  // These client columns are referenced by later VAT backfills, so ensure them before any data migration reads them.
  ensureClientInvoiceColumns();

  // Add color column to projects if it doesn't exist
  const cols = db.exec("PRAGMA table_info(projects)");
  const colNames = cols[0]?.values.map(row => row[1]) || [];
  if (!colNames.includes('color')) {
    db.run("ALTER TABLE projects ADD COLUMN color TEXT");
  }

  // Add new notes columns if they don't exist
  const noteCols = db.exec("PRAGMA table_info(notes)");
  const noteColNames = noteCols[0]?.values.map(row => row[1]) || [];
  if (!noteColNames.includes('color')) {
    db.run("ALTER TABLE notes ADD COLUMN color TEXT DEFAULT 'default'");
  }
  if (!noteColNames.includes('pinned')) {
    db.run("ALTER TABLE notes ADD COLUMN pinned INTEGER DEFAULT 0");
  }
  if (!noteColNames.includes('reminder_date')) {
    db.run("ALTER TABLE notes ADD COLUMN reminder_date TEXT");
  }
  if (!noteColNames.includes('reminder_time')) {
    db.run("ALTER TABLE notes ADD COLUMN reminder_time TEXT");
  }

  // Add amount_huf column to expenses
  const expCols = db.exec("PRAGMA table_info(expenses)");
  const expColNames = expCols[0]?.values.map(row => row[1]) || [];
  if (!expColNames.includes('amount_huf')) {
    db.run("ALTER TABLE expenses ADD COLUMN amount_huf REAL");
    // Backfill: for HUF expenses, copy amount; for others, leave null (user can re-save)
    db.run("UPDATE expenses SET amount_huf = amount WHERE currency = 'HUF'");
  }
  if (!expColNames.includes('category')) {
    db.run("ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'other'");
  }
  if (!expColNames.includes('extra_amount')) {
    db.run("ALTER TABLE expenses ADD COLUMN extra_amount REAL");
  }
  if (!expColNames.includes('extra_description')) {
    db.run("ALTER TABLE expenses ADD COLUMN extra_description TEXT");
  }

  // No test user seeding — auth is handled by Supabase

  // Migrate invoices table: make project_id nullable
  const invoiceCols = db.exec("PRAGMA table_info(invoices)");
  const invoiceColNames = invoiceCols[0]?.values.map(row => row[1]) || [];
  const projectIdCol = invoiceCols[0]?.values.find(row => row[1] === 'project_id');
  if (projectIdCol && projectIdCol[3] === 1) { // notnull = 1
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices_new (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        client_id TEXT NOT NULL,
        file_path TEXT,
        invoice_number TEXT,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'HUF',
        issue_date TEXT,
        due_date TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue')),
        notes TEXT,
        type TEXT DEFAULT 'invoice' CHECK(type IN ('invoice', 'manual')),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );
      INSERT INTO invoices_new (id, project_id, client_id, file_path, invoice_number, amount, currency, issue_date, due_date, status, notes, created_at)
        SELECT id, project_id, client_id, file_path, invoice_number, amount, currency, issue_date, due_date, status, notes, created_at FROM invoices;
      DROP TABLE invoices;
      ALTER TABLE invoices_new RENAME TO invoices;
    `);
  }

  // Add type column to invoices if it doesn't exist (for tables that already had nullable project_id)
  const invoiceCols2 = db.exec("PRAGMA table_info(invoices)");
  const invoiceColNames2 = invoiceCols2[0]?.values.map(row => row[1]) || [];
  if (!invoiceColNames2.includes('type')) {
    db.run("ALTER TABLE invoices ADD COLUMN type TEXT DEFAULT 'invoice' CHECK(type IN ('invoice', 'manual'))");
  }

  // Migrate projects table: make client_id nullable (for personal projects)
  const projCols = db.exec("PRAGMA table_info(projects)");
  const clientIdCol = projCols[0]?.values.find(row => row[1] === 'client_id');
  if (clientIdCol && clientIdCol[3] === 1) { // notnull = 1
    db.run('PRAGMA foreign_keys = OFF');
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects_new (
        id TEXT PRIMARY KEY,
        client_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on_hold', 'cancelled')),
        deadline TEXT,
        estimated_hours REAL NOT NULL,
        allocated_hours REAL DEFAULT 0,
        is_hours_distributed INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        closed_at TEXT,
        color TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );
      INSERT INTO projects_new (id, client_id, name, description, status, deadline, estimated_hours, allocated_hours, is_hours_distributed, priority, created_at, updated_at, closed_at, color)
        SELECT id, client_id, name, description, status, deadline, estimated_hours, allocated_hours, is_hours_distributed, priority, created_at, updated_at, closed_at, color FROM projects;
      DROP TABLE projects;
      ALTER TABLE projects_new RENAME TO projects;
    `);
    db.run('PRAGMA foreign_keys = ON');
  }

  // Migrate projects table: make deadline nullable
  const projCols2 = db.exec("PRAGMA table_info(projects)");
  const deadlineCol = projCols2[0]?.values.find(row => row[1] === 'deadline');
  if (deadlineCol && deadlineCol[3] === 1) { // notnull = 1
    db.run('PRAGMA foreign_keys = OFF');
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects_new2 (
        id TEXT PRIMARY KEY,
        client_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on_hold', 'cancelled')),
        deadline TEXT,
        estimated_hours REAL NOT NULL,
        allocated_hours REAL DEFAULT 0,
        is_hours_distributed INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        closed_at TEXT,
        color TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );
      INSERT INTO projects_new2 (id, client_id, name, description, status, deadline, estimated_hours, allocated_hours, is_hours_distributed, priority, created_at, updated_at, closed_at, color)
        SELECT id, client_id, name, description, status, deadline, estimated_hours, allocated_hours, is_hours_distributed, priority, created_at, updated_at, closed_at, color FROM projects;
      DROP TABLE projects;
      ALTER TABLE projects_new2 RENAME TO projects;
    `);
    db.run('PRAGMA foreign_keys = ON');
  }

  // Clean up empty string client_id/deadline values → NULL
  db.run(`UPDATE projects SET client_id = NULL WHERE client_id = ''`);
  db.run(`UPDATE projects SET deadline = NULL WHERE deadline = ''`);

  // ── Project pricing (megállapodott ár / budget) ─────────────────────
  // project_price: a projekt megállapodott ára eredeti pénznemben
  // project_price_currency: pénznem (HUF, EUR, USD, GBP, CHF...)
  // project_price_huf: HUF-ban számolt érték (statisztikákhoz, kiállítás napi árfolyamon)
  const projPriceCols = db.exec("PRAGMA table_info(projects)");
  const projPriceColNames = projPriceCols[0]?.values.map(row => row[1]) || [];
  if (!projPriceColNames.includes('project_price')) {
    db.run("ALTER TABLE projects ADD COLUMN project_price REAL DEFAULT NULL");
  }
  if (!projPriceColNames.includes('project_price_currency')) {
    db.run("ALTER TABLE projects ADD COLUMN project_price_currency TEXT DEFAULT 'HUF'");
  }
  if (!projPriceColNames.includes('project_price_huf')) {
    db.run("ALTER TABLE projects ADD COLUMN project_price_huf REAL DEFAULT NULL");
  }

  // Add actual_minutes column to calendar_events for Pomodoro tracking
  const eventCols = db.exec("PRAGMA table_info(calendar_events)");
  const eventColNames = eventCols[0]?.values.map(row => row[1]) || [];
  if (!eventColNames.includes('actual_minutes')) {
    db.run("ALTER TABLE calendar_events ADD COLUMN actual_minutes INTEGER");
  }

  // Add pomodoro_project_tracking column to user_settings
  const userCols = db.exec("PRAGMA table_info(user_settings)");
  const userColNames = userCols[0]?.values.map(row => row[1]) || [];
  if (!userColNames.includes('pomodoro_project_tracking')) {
    db.run("ALTER TABLE user_settings ADD COLUMN pomodoro_project_tracking INTEGER DEFAULT 0");
  }
  if (!userColNames.includes('revenue_goal_yearly')) {
    db.run("ALTER TABLE user_settings ADD COLUMN revenue_goal_yearly REAL DEFAULT 0");
  }
  if (!userColNames.includes('profit_goal_yearly')) {
    db.run("ALTER TABLE user_settings ADD COLUMN profit_goal_yearly REAL DEFAULT 0");
  }
  // Business info for contracts
  if (!userColNames.includes('company_name')) {
    db.run("ALTER TABLE user_settings ADD COLUMN company_name TEXT DEFAULT ''");
  }
  if (!userColNames.includes('tax_number')) {
    db.run("ALTER TABLE user_settings ADD COLUMN tax_number TEXT DEFAULT ''");
  }
  if (!userColNames.includes('address')) {
    db.run("ALTER TABLE user_settings ADD COLUMN address TEXT DEFAULT ''");
  }
  if (!userColNames.includes('bank_account')) {
    db.run("ALTER TABLE user_settings ADD COLUMN bank_account TEXT DEFAULT ''");
  }
  if (!userColNames.includes('team_mode')) {
    db.run("ALTER TABLE user_settings ADD COLUMN team_mode INTEGER DEFAULT 0");
  }
  // ── ÁFA kezelés (Fázis 1) ──
  if (!userColNames.includes('vat_status')) {
    // 'exempt' = alanyi mentes (AAM), 'standard' = áfakörös
    db.run("ALTER TABLE user_settings ADD COLUMN vat_status TEXT DEFAULT 'exempt'");
  }
  if (!userColNames.includes('vat_rate_default')) {
    db.run("ALTER TABLE user_settings ADD COLUMN vat_rate_default REAL DEFAULT 27");
  }
  if (!userColNames.includes('vat_number')) {
    db.run("ALTER TABLE user_settings ADD COLUMN vat_number TEXT DEFAULT ''");
  }
  if (!userColNames.includes('is_business')) {
    db.run("ALTER TABLE user_settings ADD COLUMN is_business INTEGER DEFAULT 1");
  }

  // Add VAT columns to invoices (amount marad bruttó, visszamenőleges kompatibilitás)
  const invColsVat = db.exec("PRAGMA table_info(invoices)");
  const invColNamesVat = invColsVat[0]?.values.map(row => row[1]) || [];
  const invNeedsBackfill: string[] = [];
  if (!invColNamesVat.includes('vat_rate')) {
    db.run("ALTER TABLE invoices ADD COLUMN vat_rate REAL DEFAULT NULL");
    invNeedsBackfill.push('vat_rate');
  }
  if (!invColNamesVat.includes('net_amount')) {
    db.run("ALTER TABLE invoices ADD COLUMN net_amount REAL DEFAULT NULL");
    invNeedsBackfill.push('net_amount');
  }
  if (!invColNamesVat.includes('vat_amount')) {
    db.run("ALTER TABLE invoices ADD COLUMN vat_amount REAL DEFAULT NULL");
    invNeedsBackfill.push('vat_amount');
  }
  if (!invColNamesVat.includes('net_amount_huf')) {
    db.run("ALTER TABLE invoices ADD COLUMN net_amount_huf REAL DEFAULT NULL");
    invNeedsBackfill.push('net_amount_huf');
  }
  if (!invColNamesVat.includes('vat_amount_huf')) {
    db.run("ALTER TABLE invoices ADD COLUMN vat_amount_huf REAL DEFAULT NULL");
    invNeedsBackfill.push('vat_amount_huf');
  }
  if (!invColNamesVat.includes('amount_huf')) {
    db.run("ALTER TABLE invoices ADD COLUMN amount_huf REAL DEFAULT NULL");
    db.run("UPDATE invoices SET amount_huf = amount WHERE currency = 'HUF' AND amount_huf IS NULL");
  }

  // Add VAT columns to expenses
  const expColsVat = db.exec("PRAGMA table_info(expenses)");
  const expColNamesVat = expColsVat[0]?.values.map(row => row[1]) || [];
  const expNeedsBackfill: string[] = [];
  if (!expColNamesVat.includes('vat_rate')) {
    db.run("ALTER TABLE expenses ADD COLUMN vat_rate REAL DEFAULT NULL");
    expNeedsBackfill.push('vat_rate');
  }
  if (!expColNamesVat.includes('net_amount')) {
    db.run("ALTER TABLE expenses ADD COLUMN net_amount REAL DEFAULT NULL");
    expNeedsBackfill.push('net_amount');
  }
  if (!expColNamesVat.includes('vat_amount')) {
    db.run("ALTER TABLE expenses ADD COLUMN vat_amount REAL DEFAULT NULL");
    expNeedsBackfill.push('vat_amount');
  }
  if (!expColNamesVat.includes('net_amount_huf')) {
    db.run("ALTER TABLE expenses ADD COLUMN net_amount_huf REAL DEFAULT NULL");
    expNeedsBackfill.push('net_amount_huf');
  }
  if (!expColNamesVat.includes('vat_amount_huf')) {
    db.run("ALTER TABLE expenses ADD COLUMN vat_amount_huf REAL DEFAULT NULL");
    expNeedsBackfill.push('vat_amount_huf');
  }
  if (!expColNamesVat.includes('vat_deductible')) {
    // 1 = visszaigényelhető áfa (áfakörös usernél), 0 = nem (AAM-nél vagy magánhasználat)
    db.run("ALTER TABLE expenses ADD COLUMN vat_deductible INTEGER DEFAULT 1");
  }

  // Opció A backfill: meglévő sorok szétbontása a user áfa-státusza alapján
  // (Fejlesztési fázisban elég egyszer lefutni; production-ben idempotens a NULL check miatt.)
  if (invNeedsBackfill.length > 0 || expNeedsBackfill.length > 0) {
    const userVatRow = db.exec("SELECT vat_status, vat_rate_default FROM user_settings LIMIT 1");
    const userVatStatus = (userVatRow[0]?.values[0]?.[0] as string) || 'exempt';
    const userVatRate = (userVatRow[0]?.values[0]?.[1] as number) ?? 27;

    if (userVatStatus === 'exempt') {
      // AAM: nincs áfa, nettó = bruttó
      db.run(`UPDATE invoices SET
        vat_rate = 0,
        net_amount = amount,
        vat_amount = 0,
        net_amount_huf = COALESCE(amount_huf, amount),
        vat_amount_huf = 0
        WHERE net_amount IS NULL`);
      db.run(`UPDATE expenses SET
        vat_rate = 0,
        net_amount = amount,
        vat_amount = 0,
        net_amount_huf = COALESCE(amount_huf, amount),
        vat_amount_huf = 0
        WHERE net_amount IS NULL`);
    } else {
      // Standard: amount bruttó, áfát visszaszámoljuk vat_rate_default alapján
      const rateDecimal = userVatRate / 100;
      db.run(`UPDATE invoices SET
        vat_rate = ?,
        net_amount = ROUND(amount / (1 + ?), 2),
        vat_amount = ROUND(amount - (amount / (1 + ?)), 2),
        net_amount_huf = ROUND(COALESCE(amount_huf, amount) / (1 + ?), 2),
        vat_amount_huf = ROUND(COALESCE(amount_huf, amount) - (COALESCE(amount_huf, amount) / (1 + ?)), 2)
        WHERE net_amount IS NULL`, [userVatRate, rateDecimal, rateDecimal, rateDecimal, rateDecimal]);
      db.run(`UPDATE expenses SET
        vat_rate = ?,
        net_amount = ROUND(amount / (1 + ?), 2),
        vat_amount = ROUND(amount - (amount / (1 + ?)), 2),
        net_amount_huf = ROUND(COALESCE(amount_huf, amount) / (1 + ?), 2),
        vat_amount_huf = ROUND(COALESCE(amount_huf, amount) - (COALESCE(amount_huf, amount) / (1 + ?)), 2)
        WHERE net_amount IS NULL`, [userVatRate, rateDecimal, rateDecimal, rateDecimal, rateDecimal]);
    }
  }

  db.exec(`
    UPDATE invoices
    SET
      vat_rate = 0,
      net_amount = amount,
      vat_amount = 0,
      net_amount_huf = COALESCE(amount_huf, amount),
      vat_amount_huf = 0
    WHERE client_id IN (
      SELECT id FROM clients
      WHERE UPPER(COALESCE(country_code, 'HU')) NOT IN (
        'HU', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
        'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL',
        'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
      )
    )
      AND COALESCE(vat_amount, 0) != 0;

    UPDATE invoices
    SET
      vat_rate = 0,
      net_amount = amount,
      vat_amount = 0,
      net_amount_huf = COALESCE(amount_huf, amount),
      vat_amount_huf = 0
    WHERE client_id IN (
      SELECT id FROM clients
      WHERE UPPER(COALESCE(country_code, 'HU')) IN (
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
        'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL',
        'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
      )
        AND TRIM(COALESCE(eu_vat_number, '')) != ''
    )
      AND COALESCE(vat_amount, 0) != 0;
  `);

  // Seed tax business types and 2026 rules (idempotent via INSERT OR IGNORE)
  db.exec(`
    INSERT OR IGNORE INTO tax_business_types (id, code, name_hu, description, sort_order) VALUES
      ('kiva',          'KIVA',          'Kisvállalati Adó',              'Kisvállalati adó - kis- és középvállalkozásoknak',        1),
      ('afa',           'AFA',           'Általános Forgalmi Adó',        'ÁFA - 27%-os általános forgalmi adó',                    2),
      ('aam',           'AAM',           'Alanyi Adómentesség',           'Alanyi adómentesség - ÁFA-mentes működés',               3),
      ('atalanyadozas', 'ATALANYADOZAS', 'Átalányadózás',                 'Egyszerűsített SZJA egyéni vállalkozóknak',               4),
      ('kft_tao',       'KFT_TAO',       'Kft (TAO)',                     'Korlátolt felelősségű társaság - társasági adó',          5);

    INSERT OR IGNORE INTO tax_rules (id, business_type, year, rate_percent, rate_label, notes) VALUES
      ('tr-kiva-2026',       'kiva',          2026, 10.0,   'base',                'Speciális adóalap: béralapú számítás'),
      ('tr-afa-std-2026',    'afa',           2026, 27.0,   'standard',            'EU egyik legmagasabb ÁFA kulcsa'),
      ('tr-afa-red-2026',    'afa',           2026, 18.0,   'reduced',             'Csökkentett kulcs (pl. egyes élelmiszerek)'),
      ('tr-afa-sred-2026',   'afa',           2026,  5.0,   'super_reduced',       'Szuper csökkentett kulcs (pl. könyvek)'),
      ('tr-aam-2026',        'aam',           2026,  0.0,   'exempt',              'ÁFA-mentes - 20M Ft bevételi határ'),
      ('tr-atal-gen-2026',   'atalanyadozas', 2026, 45.0,   'deemed_cost_general', 'Általános vélelmezett költséghányad'),
      ('tr-atal-ret-2026',   'atalanyadozas', 2026, 80.0,   'deemed_cost_retail',  'Kiskereskedelmi vélelmezett költséghányad'),
      ('tr-atal-kisker-2026','atalanyadozas', 2026, 90.0,   'deemed_cost_kisker',  'Üzletszerű kiskereskedelmi vélelmezett költséghányad'),
      ('tr-tao-2026',        'kft_tao',       2026,  9.0,   'base',                'Társasági adó alapkulcs');

    INSERT OR IGNORE INTO tax_eligibility_criteria (id, business_type, year, max_revenue_huf, max_employees, conditions_json) VALUES
      ('te-kiva-2026',  'kiva',          2026, 6000000000,  100,  '{"replaces":["tao","szocho","szakkepzesi_hozzajarulas"]}'),
      ('te-aam-2026',   'aam',           2026, 20000000,    NULL, '{"progressive_increase":{"2027":22000000,"2028":24000000}}'),
      ('te-atal-2026',  'atalanyadozas', 2026, NULL,        NULL, '{"entity_type":"egyeni_vallalkozo","simplified_szja":true}'),
      ('te-kft-2026',   'kft_tao',       2026, NULL,        NULL, '{"entity_type":"kft","alternative":"kiva"}');
  `);

  // Fix legacy data: update átalány 40→45%, KIVA 11→10%, remove KATA
  db.run(`UPDATE tax_rules SET rate_percent = 45.0 WHERE id = 'tr-atal-gen-2026' AND rate_percent = 40.0`);
  db.run(`UPDATE tax_rules SET rate_percent = 10.0 WHERE id = 'tr-kiva-2026' AND rate_percent = 11.0`);
  db.run(`DELETE FROM tax_rules WHERE business_type = 'kata'`);
  db.run(`DELETE FROM tax_eligibility_criteria WHERE business_type = 'kata'`);
  db.run(`DELETE FROM tax_business_types WHERE id = 'kata'`);

  // Seed tax_parameters for 2026 and 2027
  db.exec(`
    INSERT OR IGNORE INTO tax_parameters (
      year, minimalber_havi, garantalt_berminimum_havi,
      szja_kulcs, tb_kulcs, szocho_kulcs, tao_kulcs, kiva_kulcs,
      aam_limit, atalany_altalanos, atalany_specialis, atalany_kisker,
      atalany_limit_szorzo, atalany_adomentes_szorzo, szocho_plafon_szorzo,
      hipa_max_kulcs, afa_standard, afa_reduced, afa_super_reduced
    ) VALUES
      (2026, 322800, 373200, 0.15, 0.185, 0.13, 0.09, 0.10,
       20000000, 0.45, 0.80, 0.90, 10, 0.5, 24, 0.02, 0.27, 0.18, 0.05),
      (2027, 322800, 373200, 0.15, 0.185, 0.13, 0.09, 0.10,
       22000000, 0.50, 0.80, 0.90, 10, 0.5, 24, 0.02, 0.27, 0.18, 0.05);
  `);

  // Seed HIPA rates from embedded data (idempotent)
  const hipaCount = db.exec('SELECT COUNT(*) as cnt FROM hipa_rates');
  const existingHipa = (hipaCount[0]?.values[0]?.[0] as number) ?? 0;
  if (existingHipa === 0) {
    const insertStmt = db.prepare('INSERT OR IGNORE INTO hipa_rates (megye, telepules, kulcs) VALUES (?, ?, ?)');
    for (const entry of HIPA_RATES) {
      insertStmt.run([entry.megye, entry.telepules, entry.kulcs]);
    }
    insertStmt.free();
    console.log(`[Database] Seeded ${HIPA_RATES.length} HIPA rates`);
  }

  ensureClientInvoiceColumns();

  // Add billing provider fields to invoices for API-generated invoices
  const invCols3 = db.exec("PRAGMA table_info(invoices)");
  const invColNames3 = invCols3[0]?.values.map(row => row[1]) || [];
  if (!invColNames3.includes('provider')) {
    db.run("ALTER TABLE invoices ADD COLUMN provider TEXT DEFAULT NULL");
  }
  if (!invColNames3.includes('provider_invoice_id')) {
    db.run("ALTER TABLE invoices ADD COLUMN provider_invoice_id TEXT DEFAULT NULL");
  }
  if (!invColNames3.includes('provider_synced_at')) {
    db.run("ALTER TABLE invoices ADD COLUMN provider_synced_at TEXT DEFAULT NULL");
  }

  // Migrate invoices: add 'cancelled' to status CHECK constraint
  const statusCol = invCols3[0]?.values.find(row => row[1] === 'status');
  const currentSql = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='invoices'");
  const tableSql = currentSql[0]?.values[0]?.[0] as string || '';
  if (statusCol && !tableSql.includes("'cancelled'")) {
    // Get current column list to preserve all columns including later additions
    const allCols = invCols3[0]?.values.map(row => row[1] as string) || [];
    const colList = allCols.join(', ');
    db.run('PRAGMA foreign_keys = OFF');
    db.exec(`
      CREATE TABLE invoices_migrated (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        client_id TEXT NOT NULL,
        file_path TEXT,
        invoice_number TEXT,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'HUF',
        issue_date TEXT,
        due_date TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue', 'cancelled')),
        notes TEXT,
        type TEXT DEFAULT 'invoice' CHECK(type IN ('invoice', 'manual')),
        created_at TEXT DEFAULT (datetime('now')),
        provider TEXT DEFAULT NULL,
        provider_invoice_id TEXT DEFAULT NULL,
        provider_synced_at TEXT DEFAULT NULL,
        gross_total REAL DEFAULT NULL,
        net_total REAL DEFAULT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );
      INSERT INTO invoices_migrated (${colList}) SELECT ${colList} FROM invoices;
      DROP TABLE invoices;
      ALTER TABLE invoices_migrated RENAME TO invoices;
    `);
    db.run('PRAGMA foreign_keys = ON');
  }

  // Add client_id to ads_accounts for linking Ads accounts to Klient clients
  // Guard: only run if the table exists (ads module may not be present in all builds)
  const adsAccCols = db.exec("PRAGMA table_info(ads_accounts)");
  const adsAccColNames = adsAccCols[0]?.values.map(row => row[1]) || [];
  if (adsAccColNames.length > 0 && !adsAccColNames.includes('client_id')) {
    db.run("ALTER TABLE ads_accounts ADD COLUMN client_id TEXT REFERENCES clients(id) ON DELETE SET NULL");
    db.run("CREATE INDEX IF NOT EXISTS idx_ads_accounts_client ON ads_accounts(client_id)");
  }

  // Add status to team_members
  const teamCols = db.exec("PRAGMA table_info(team_members)");
  const teamColNames = teamCols[0]?.values.map(row => row[1]) || [];
  if (!teamColNames.includes('status')) {
    db.run("ALTER TABLE team_members ADD COLUMN status TEXT DEFAULT 'active'");
  }
  if (!teamColNames.includes('monthly_salary')) {
    db.run("ALTER TABLE team_members ADD COLUMN monthly_salary REAL");
  }
  if (!teamColNames.includes('salary_currency')) {
    db.run("ALTER TABLE team_members ADD COLUMN salary_currency TEXT DEFAULT 'HUF'");
  }
  if (!teamColNames.includes('salary_huf')) {
    db.run("ALTER TABLE team_members ADD COLUMN salary_huf REAL");
  }

  // Per-project fee on assignments
  const paCols = db.exec("PRAGMA table_info(project_assignments)");
  const paColNames = paCols[0]?.values.map(row => row[1]) || [];
  if (!paColNames.includes('fee')) {
    db.run("ALTER TABLE project_assignments ADD COLUMN fee REAL");
  }
  if (!paColNames.includes('fee_currency')) {
    db.run("ALTER TABLE project_assignments ADD COLUMN fee_currency TEXT DEFAULT 'HUF'");
  }
  if (!paColNames.includes('fee_huf')) {
    db.run("ALTER TABLE project_assignments ADD COLUMN fee_huf REAL");
  }

  // ── Multi-currency payment tracking (Sztv. §60) ─────────────────────
  // paid_date: beérkezés napja (pénzforgalmi szemléletű elszámoláshoz)
  // paid_exchange_rate: beérkezés napi árfolyam (deviza → HUF)
  // paid_amount_huf: beérkezéskor ténylegesen befolyt összeg HUF-ban
  // issue_exchange_rate: kiállításkor érvényes árfolyam (könyvelt érték — amount_huf ezzel számolt)
  const invColsPay = db.exec("PRAGMA table_info(invoices)");
  const invColNamesPay = invColsPay[0]?.values.map(row => row[1]) || [];
  if (!invColNamesPay.includes('paid_date')) {
    db.run("ALTER TABLE invoices ADD COLUMN paid_date TEXT DEFAULT NULL");
  }
  if (!invColNamesPay.includes('paid_exchange_rate')) {
    db.run("ALTER TABLE invoices ADD COLUMN paid_exchange_rate REAL DEFAULT NULL");
  }
  if (!invColNamesPay.includes('paid_amount_huf')) {
    db.run("ALTER TABLE invoices ADD COLUMN paid_amount_huf REAL DEFAULT NULL");
  }
  if (!invColNamesPay.includes('issue_exchange_rate')) {
    db.run("ALTER TABLE invoices ADD COLUMN issue_exchange_rate REAL DEFAULT NULL");
  }
  // Backfill: existing paid invoices — treat amount_huf as paid_amount_huf, issue_date as paid_date
  db.run(`UPDATE invoices
          SET paid_date = COALESCE(paid_date, issue_date),
              paid_amount_huf = COALESCE(paid_amount_huf, amount_huf, amount)
          WHERE status = 'paid' AND paid_amount_huf IS NULL`);
}
