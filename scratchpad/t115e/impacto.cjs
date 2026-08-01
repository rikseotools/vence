const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const arts = ['132','133','134','141','144','147'];
  const r = await c.query(`
    SELECT count(DISTINCT t.id) AS temas, count(DISTINCT t.position_type) AS oposiciones
      FROM topic_scope ts
      JOIN laws l ON l.id=ts.law_id
      JOIN topics t ON t.id=ts.topic_id
     WHERE l.slug='ley-9-2017'
       AND (ts.article_numbers IS NULL OR ts.article_numbers && $1)`, [arts]);
  console.table(r.rows);
  const u = await c.query(`
    SELECT count(*) AS usuarios FROM user_profiles
     WHERE target_oposicion IN (
       SELECT DISTINCT t.position_type FROM topic_scope ts
         JOIN laws l ON l.id=ts.law_id JOIN topics t ON t.id=ts.topic_id
        WHERE l.slug='ley-9-2017' AND (ts.article_numbers IS NULL OR ts.article_numbers && $1))`, [arts]);
  console.log('usuarios con una de esas oposiciones como objetivo:', u.rows[0].usuarios);
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
