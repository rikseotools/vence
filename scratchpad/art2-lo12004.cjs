require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const d = await c.query(`SELECT question_id FROM question_disputes WHERE id='73666b0c-0a8a-4a9c-b44f-d752a6822aca'`);
  console.log('QID:', d.rows[0].question_id);
  const { rows } = await c.query(`SELECT a.content, l.boe_url FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id WHERE q.id=$1`, [d.rows[0].question_id]);
  console.log('BOE:', rows[0].boe_url);
  console.log('\n=== ART. 2 (nuestro texto) ===\n' + rows[0].content);
  await c.end();
})();
