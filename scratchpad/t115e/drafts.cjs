const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const r = await c.query(`
    SELECT a.article_number, q.id, q.lifecycle_state, q.created_at,
           q.question_text, q.explanation
      FROM questions q JOIN articles a ON a.id=q.primary_article_id
      JOIN laws l ON l.id=a.law_id
     WHERE l.slug='ley-9-2017' AND a.article_number = ANY($1)
     ORDER BY a.article_number::int, q.id`, [['132','133','134','147']]);
  for (const row of r.rows) {
    console.log('─'.repeat(90));
    console.log(`art ${row.article_number} · id=${row.id} · ${row.lifecycle_state} · ${row.created_at.toISOString().slice(0,10)}`);
    console.log('P:', row.question_text);
    console.log('E:', (row.explanation||'').slice(0,300));
  }
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
