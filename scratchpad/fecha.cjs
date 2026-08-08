require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const r = await c.query(`SELECT id, resolved_at, resolved_at AT TIME ZONE 'Europe/Madrid' AS madrid FROM question_disputes WHERE id='e1b2b9e4-1367-4690-9da8-c8c6ee16e574'`);
  console.log(r.rows[0]);
  console.log('ahora:', (await c.query(`SELECT now() AT TIME ZONE 'Europe/Madrid' AS madrid`)).rows[0]);
  await c.end();
})();
