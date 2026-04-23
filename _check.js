const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(path.join(require('os').homedir(), 'AppData', 'Roaming', 'klient', 'klient.db'));
  const db = new SQL.Database(buf);
  const rows = db.exec("SELECT p.id, p.name, p.client_id, c.name as client_name, p.status FROM projects p LEFT JOIN clients c ON p.client_id = c.id");
  if (rows.length) {
    console.log('Columns:', rows[0].columns.join(' | '));
    rows[0].values.forEach(r => console.log(r.join(' | ')));
  }
})();
