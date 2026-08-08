require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT amount, status, created_at FROM reward_submissions WHERE dispute_id=$1`, ['977468c3-6b0e-4b86-af6d-48efd84615b5']);
  console.log('recompensa:', rows.length ? JSON.stringify(rows[0]) : 'NO CONCEDIDA');
  await c.end();
})();
