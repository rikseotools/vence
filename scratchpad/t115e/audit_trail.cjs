const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const r = await c.query(`
    SELECT h.from_state, h.to_state, h.reason_code, count(*) AS n
      FROM question_lifecycle_history h
     WHERE h.question_id IN (SELECT id FROM questions WHERE 'gen_lcsp5_2026-07-31_t115e' = ANY(tags))
     GROUP BY 1,2,3 ORDER BY 4 DESC`);
  console.log('=== audit trail (question_lifecycle_history) ===');
  console.table(r.rows);
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
