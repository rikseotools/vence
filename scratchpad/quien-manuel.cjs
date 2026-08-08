const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const r = await c.query(
    "SELECT id, email, full_name, plan_type, created_at FROM user_profiles " +
    "WHERE email ILIKE '%manuel%' OR full_name ILIKE '%manuel%' OR email ILIKE '%trar%' " +
    "ORDER BY created_at LIMIT 30"
  );
  console.table(r.rows);
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
