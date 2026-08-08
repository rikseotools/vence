require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const d = await c.query(`SELECT id, dispute_type, status, claimed_by,
      round(extract(epoch from (now()-claimed_at))/60) AS min FROM question_disputes
      WHERE status IN ('pending','appealed') ORDER BY created_at`);
  console.log('=== IMPUGNACIONES ABIERTAS ===');
  console.table(d.rows.map(r=>({id:r.id.slice(0,8),tipo:r.dispute_type,estado:r.status,sesion:r.claimed_by?r.claimed_by.slice(0,8):'— LIBRE',min:r.min})));
  const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='worktree_sessions'`);
  console.log('cols worktree_sessions:', cols.rows.map(r=>r.column_name).join(', '));
  const s = await c.query(`SELECT * FROM worktree_sessions ORDER BY 1 DESC LIMIT 12`);
  console.log(JSON.stringify(s.rows, null, 1).slice(0, 2500));
  await c.end();
})();
