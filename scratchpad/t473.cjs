require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const r = await c.query(`SELECT id, title, status, priority, claimed_by, claimed_at FROM backlog_tasks WHERE id IN ('T-470','T-471','T-473')`);
  console.table(r.rows);
  await c.end();
})();
