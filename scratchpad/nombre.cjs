require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const r = await c.query(`SELECT full_name, email, plan_type, target_oposicion FROM user_profiles WHERE id=(SELECT user_id FROM question_disputes WHERE id='67ad1dd4-1897-40aa-bd4a-5b04f1e3d029')`);
  console.log(r.rows);
  await c.end();
})();
