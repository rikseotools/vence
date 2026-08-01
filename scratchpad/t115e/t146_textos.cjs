const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const r = await c.query(`
    SELECT a.article_number, a.title, a.content
      FROM articles a JOIN laws l ON l.id=a.law_id
     WHERE l.slug='ley-igualdad-genero-andalucia' AND a.is_active
       AND a.article_number = ANY($1)
     ORDER BY (regexp_replace(a.article_number,'\\D','','g'))::int, a.article_number`,
    [['11 bis','15 bis','21 bis','26 bis','37 bis','48 bis','50 bis','50 ter','50 quater','52 bis']]);
  for (const row of r.rows) {
    console.log('='.repeat(100));
    console.log(`ART ${row.article_number} — ${row.title}`);
    console.log('='.repeat(100));
    console.log(row.content); console.log();
  }
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
