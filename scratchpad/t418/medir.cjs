const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const r = await c.query(`
    SELECT * FROM observable_events
    WHERE error_message LIKE '%límite diario%'
      AND created_at > now() - interval '7 days'
    ORDER BY created_at DESC LIMIT 2`);
  console.log(JSON.stringify(r.rows, null, 2).slice(0, 3000));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
