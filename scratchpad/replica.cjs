require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const r = await c.query(`SELECT id, status, resolved_at, appeal_text, left(coalesce(admin_response,''),80) AS resp
    FROM question_disputes WHERE id::text LIKE '349b5132%'`);
  for (const x of r.rows) {
    console.log('status:', x.status, '| resolved_at:', x.resolved_at);
    console.log('admin_response (inicio):', x.resp);
    console.log('appeal_text:', x.appeal_text);
  }
  await c.end();
})();
