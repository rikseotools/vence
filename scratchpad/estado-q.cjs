require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const r = await c.query(`SELECT id, explanation_data IS NOT NULL AS estructurada, shuffle_safety, lifecycle_state
    FROM questions WHERE id=(SELECT question_id FROM question_disputes WHERE id='e1b2b9e4-1367-4690-9da8-c8c6ee16e574')`);
  console.log(r.rows[0]);
  await c.end();
})();
