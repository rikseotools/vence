require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT l.id, l.short_name, l.name, l.boe_url, l.scope, l.last_verification_summary
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE q.id=(SELECT question_id FROM question_disputes WHERE id='977468c3-6b0e-4b86-af6d-48efd84615b5')`);
  console.log(JSON.stringify(rows[0], null, 1));
  await c.end();
})();
