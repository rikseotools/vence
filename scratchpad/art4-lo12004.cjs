require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT a.article_number, left(a.content, 1200) content FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.short_name ILIKE '%1/2004%' AND a.article_number IN ('4') AND a.is_active`);
  for (const r of rows) console.log('=== ART. ' + r.article_number + ' ===\n' + r.content + '\n');
  await c.end();
})();
