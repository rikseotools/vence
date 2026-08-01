const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const arts = ['132','133','134','141','144','147'];
  const q = await c.query(`
    SELECT a.article_number,
           length(a.content) AS len,
           count(q.id) FILTER (WHERE q.is_active) AS activas,
           count(q.id) FILTER (WHERE q.lifecycle_state='draft') AS borrador,
           count(q.id) AS total
      FROM articles a
      JOIN laws l ON l.id=a.law_id
      LEFT JOIN questions q ON q.primary_article_id=a.id
     WHERE l.slug='ley-9-2017' AND a.article_number = ANY($1) AND a.is_active
     GROUP BY a.article_number, a.content
     ORDER BY a.article_number::int`, [arts]);
  console.log('=== estado de los 6 artículos del lote ===');
  console.table(q.rows);
  const r = await c.query(`
    SELECT a.article_number, count(*) AS n, max(q.created_at) AS ultima
      FROM questions q JOIN articles a ON a.id=q.primary_article_id
      JOIN laws l ON l.id=a.law_id
     WHERE l.slug='ley-9-2017' AND q.created_at > now() - interval '48 hours'
     GROUP BY a.article_number ORDER BY 3 DESC`);
  console.log('=== preguntas creadas en la Ley 9/2017 en 48h (otras sesiones) ===');
  console.table(r.rows);
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
