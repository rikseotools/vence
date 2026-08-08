require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT a2.article_number, left(a2.content,900) content
    FROM questions q JOIN articles a ON a.id=q.primary_article_id
    JOIN articles a2 ON a2.law_id=a.law_id AND a2.article_number IN ('4','7') AND a2.is_active
    WHERE q.id='fae0370f-1d0a-48f4-ba7f-06b6b05bb069' ORDER BY a2.article_number`);
  for (const r of rows) console.log('=== ART. ' + r.article_number + ' ===\n' + r.content + '\n');
  await c.end();
})();
