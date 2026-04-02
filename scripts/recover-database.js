/**
 * Database Recovery Script
 *
 * This script helps recover data from a different user's database file
 * and migrate it to the currently logged-in user's database.
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const APP_DATA_DIR = path.join(process.env.APPDATA || process.env.HOME, 'Klient');

async function inspectDatabase(dbPath) {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log(`\n=== Inspecting: ${path.basename(dbPath)} ===`);
  console.log(`Size: ${(fs.statSync(dbPath).size / 1024 / 1024).toFixed(2)} MB`);

  const tables = [
    'clients',
    'projects',
    'calendar_events',
    'notes',
    'invoices',
    'contracts',
    'expenses',
    'team_members',
    'recordings'
  ];

  const counts = {};
  for (const table of tables) {
    try {
      const result = db.exec(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = result[0]?.values[0]?.[0] || 0;
    } catch (err) {
      counts[table] = 'error';
    }
  }

  console.log('Data counts:');
  Object.entries(counts).forEach(([table, count]) => {
    console.log(`  ${table}: ${count}`);
  });

  db.close();
  return counts;
}

async function migrateData(sourceDbPath, targetUserId) {
  const SQL = await initSqlJs();

  // Load source database
  const sourceBuffer = fs.readFileSync(sourceDbPath);
  const sourceDb = new SQL.Database(sourceBuffer);

  // Load or create target database
  const targetDbPath = path.join(APP_DATA_DIR, `klient-${targetUserId}.db`);
  let targetDb;

  if (fs.existsSync(targetDbPath)) {
    const targetBuffer = fs.readFileSync(targetDbPath);
    targetDb = new SQL.Database(targetBuffer);
    console.log(`\nTarget database exists: ${targetDbPath}`);
  } else {
    console.log(`\nTarget database does not exist yet: ${targetDbPath}`);
    console.log('It will be created when the user logs in.');
    return;
  }

  console.log('\n=== Starting Migration ===');

  const tables = [
    'clients',
    'projects',
    'calendar_events',
    'notes',
    'invoices',
    'contracts',
    'expenses',
    'team_members',
    'project_assignments',
    'recordings',
    'shortcuts',
    'tax_calculations',
    'user_tax_settings'
  ];

  for (const table of tables) {
    try {
      // Check if source has data
      const countResult = sourceDb.exec(`SELECT COUNT(*) FROM ${table}`);
      const count = countResult[0]?.values[0]?.[0] || 0;

      if (count === 0) {
        console.log(`  ${table}: skipped (empty)`);
        continue;
      }

      // Get all data from source
      const dataResult = sourceDb.exec(`SELECT * FROM ${table}`);
      if (!dataResult[0]) {
        console.log(`  ${table}: skipped (no data)`);
        continue;
      }

      const columns = dataResult[0].columns;
      const values = dataResult[0].values;

      // Clear existing data in target (optional - uncomment if you want to replace)
      // targetDb.run(`DELETE FROM ${table}`);

      // Insert into target
      const placeholders = columns.map(() => '?').join(', ');
      const insertSql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

      let insertedCount = 0;
      for (const row of values) {
        try {
          targetDb.run(insertSql, row);
          insertedCount++;
        } catch (err) {
          console.error(`    Error inserting row: ${err.message}`);
        }
      }

      console.log(`  ${table}: migrated ${insertedCount}/${count} rows`);
    } catch (err) {
      console.error(`  ${table}: error - ${err.message}`);
    }
  }

  // Save target database
  const data = targetDb.export();
  fs.writeFileSync(targetDbPath, Buffer.from(data));
  console.log('\n=== Migration Complete ===');
  console.log(`Target database saved: ${targetDbPath}`);

  sourceDb.close();
  targetDb.close();
}

async function listAllDatabases() {
  console.log('=== All Database Files ===');
  const files = fs.readdirSync(APP_DATA_DIR).filter(f => f.endsWith('.db'));

  for (const file of files) {
    const filePath = path.join(APP_DATA_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`${file}: ${sizeMB} MB (modified: ${stats.mtime.toISOString()})`);
  }
  console.log('');
}

async function main() {
  const command = process.argv[2];

  if (command === 'list') {
    await listAllDatabases();
    return;
  }

  if (command === 'inspect') {
    const dbFile = process.argv[3];
    if (!dbFile) {
      console.error('Usage: node recover-database.js inspect <db-filename>');
      process.exit(1);
    }
    const dbPath = path.join(APP_DATA_DIR, dbFile);
    await inspectDatabase(dbPath);
    return;
  }

  if (command === 'inspect-all') {
    await listAllDatabases();
    const files = fs.readdirSync(APP_DATA_DIR).filter(f => f.startsWith('klient-') && f.endsWith('.db'));
    for (const file of files) {
      const filePath = path.join(APP_DATA_DIR, file);
      await inspectDatabase(filePath);
    }
    return;
  }

  if (command === 'migrate') {
    const sourceDbFile = process.argv[3];
    const targetUserId = process.argv[4];

    if (!sourceDbFile || !targetUserId) {
      console.error('Usage: node recover-database.js migrate <source-db-filename> <target-user-id>');
      console.error('Example: node recover-database.js migrate klient-d7da8d34-309d-4089-82f7-5d9aad245c6e.db 4eae9ae0-7f43-446d-9580-cf22f90744a3');
      process.exit(1);
    }

    const sourceDbPath = path.join(APP_DATA_DIR, sourceDbFile);
    if (!fs.existsSync(sourceDbPath)) {
      console.error(`Source database not found: ${sourceDbPath}`);
      process.exit(1);
    }

    await migrateData(sourceDbPath, targetUserId);
    return;
  }

  if (command === 'rename') {
    const sourceDbFile = process.argv[3];
    const targetUserId = process.argv[4];

    if (!sourceDbFile || !targetUserId) {
      console.error('Usage: node recover-database.js rename <source-db-filename> <target-user-id>');
      console.error('Example: node recover-database.js rename klient-d7da8d34-309d-4089-82f7-5d9aad245c6e.db 4eae9ae0-7f43-446d-9580-cf22f90744a3');
      process.exit(1);
    }

    const sourceDbPath = path.join(APP_DATA_DIR, sourceDbFile);
    const targetDbPath = path.join(APP_DATA_DIR, `klient-${targetUserId}.db`);
    const backupPath = targetDbPath + '.backup';

    if (!fs.existsSync(sourceDbPath)) {
      console.error(`Source database not found: ${sourceDbPath}`);
      process.exit(1);
    }

    // Backup existing target if it exists
    if (fs.existsSync(targetDbPath)) {
      console.log(`Backing up existing database to: ${path.basename(backupPath)}`);
      fs.copyFileSync(targetDbPath, backupPath);
    }

    // Rename source to target
    console.log(`Renaming ${path.basename(sourceDbPath)} to klient-${targetUserId}.db`);
    fs.renameSync(sourceDbPath, targetDbPath);
    console.log('Done! The app should now see the recovered data.');
    return;
  }

  console.log('Database Recovery Tool');
  console.log('');
  console.log('Commands:');
  console.log('  list                                    - List all database files');
  console.log('  inspect-all                             - Inspect all databases');
  console.log('  inspect <db-filename>                   - Inspect a specific database');
  console.log('  migrate <source-db> <target-user-id>    - Migrate data to target user');
  console.log('  rename <source-db> <target-user-id>     - Rename source DB to target (simpler, replaces)');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/recover-database.js list');
  console.log('  node scripts/recover-database.js inspect-all');
  console.log('  node scripts/recover-database.js rename klient-d7da8d34-309d-4089-82f7-5d9aad245c6e.db 4eae9ae0-7f43-446d-9580-cf22f90744a3');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
