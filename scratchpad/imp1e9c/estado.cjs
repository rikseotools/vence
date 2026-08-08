require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const r = await c.query(`SELECT id, status, claimed_by, claimed_at, resolved_at,
      left(coalesce(admin_response,''), 160) AS respuesta
    FROM question_disputes WHERE id IN ('1e9c09f6-b0c1-4d86-bc16-871c9c73777c','67ad1dd4-1897-40aa-bd4a-5b04f1e3d029')`);
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})();
