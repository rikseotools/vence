require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT a.content, l.boe_url FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE q.id=(SELECT question_id FROM question_disputes WHERE id='c7ade8a3-1c85-4e84-a870-f9b6d0e78e88')`);
  console.log('BOE: ' + rows[0].boe_url + '\n' + rows[0].content);
  await c.end();
})();
