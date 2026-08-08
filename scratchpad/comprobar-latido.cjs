require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT session_id, worktree_path, last_seen_at FROM worktree_sessions WHERE session_id LIKE 'sesion-07ago%'`);
  console.log(rows.length ? JSON.stringify(rows[0], null, 1) : 'sin fila');
  await c.end();
})();
