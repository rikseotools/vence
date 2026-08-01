const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const r = await c.query(`
    SELECT a.id, a.article_number, a.title, a.content
      FROM articles a JOIN laws l ON l.id=a.law_id
     WHERE l.slug='ley-9-2017' AND a.article_number = ANY($1) AND a.is_active
     ORDER BY a.article_number::int`, [['132','133','134','141','144','147']]);
  for (const row of r.rows) {
    console.log('='.repeat(100));
    console.log(`ART ${row.article_number} — ${row.title}   [id=${row.id}]`);
    console.log('='.repeat(100));
    console.log(row.content);
    console.log();
  }
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
