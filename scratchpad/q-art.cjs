require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const q = await c.query(`SELECT q.id, q.lifecycle_state, q.shuffle_safety, q.explanation_data IS NOT NULL AS has_ed, a.article_number, a.title, a.content, l.short_name, l.boe_url
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE q.id=(SELECT question_id FROM question_disputes WHERE id='67ad1dd4-1897-40aa-bd4a-5b04f1e3d029')`);
  console.log(JSON.stringify(q.rows[0], null, 2));
  await c.end();
})();
