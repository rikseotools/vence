require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const d = await c.query(`SELECT id, dispute_type, status, claimed_by, claimed_at,
      round(extract(epoch from (now()-claimed_at))/60) AS min_desde_claim
    FROM question_disputes WHERE status IN ('pending','appealed') AND claimed_by IS NOT NULL ORDER BY claimed_at`);
  console.log('=== IMPUGNACIONES RESERVADAS ===');
  console.table(d.rows.map(r => ({ id: r.id.slice(0,8), tipo: r.dispute_type, sesion: r.claimed_by, min: r.min_desde_claim })));
  const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%session%' OR table_name ILIKE '%latido%' OR table_name ILIKE '%heartbeat%'`);
  console.log('tablas candidatas:', t.rows.map(r=>r.table_name).join(', '));
  await c.end();
})();
