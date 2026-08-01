const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const r = await c.query(`
    SELECT count(DISTINCT tp.id) AS temas,
           count(DISTINCT tp.position_type) AS oposiciones
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN topic_scope ts ON ts.law_id = a.law_id
        AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
      JOIN topics tp ON tp.id = ts.topic_id
      JOIN oposiciones o ON replace(o.slug,'-','_') = tp.position_type
     WHERE 'gen_lcsp5_2026-07-31_t115e' = ANY(q.tags)
       AND tp.disponible AND o.is_active`);
  console.log('temas DISPONIBLES de oposiciones ACTIVAS que sirven este lote:');
  console.table(r.rows);
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
