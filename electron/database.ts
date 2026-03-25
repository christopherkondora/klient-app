import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: SqlJsDatabase;
let dbPath: string;

export function getDb(): SqlJsDatabase {
  return db;
}

export function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export async function initDatabase() {
  dbPath = path.join(app.getPath('userData'), 'klient.db');

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
}

function createTables() {
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
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue')),
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
  `);
}

function runMigrations() {
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
}
