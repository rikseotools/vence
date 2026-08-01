const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const r = await c.query(`
    SELECT count(DISTINCT tp.id) AS temas, count(DISTINCT tp.position_type) AS oposiciones
      FROM questions q
      JOIN articles a ON a.id=q.primary_article_id
      JOIN topic_scope ts ON ts.law_id=a.law_id
        AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
      JOIN topics tp ON tp.id=ts.topic_id
      JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
     WHERE 'gen_lig_and_2026-08-01_t146' = ANY(q.tags) AND tp.disponible AND o.is_active`);
  console.log('temas/oposiciones que servirán el lote:'); console.table(r.rows);
  const d = await c.query(`
    SELECT count(*) AS reforma_huerfanos_restantes
      FROM articles a JOIN laws l ON l.id=a.law_id
     WHERE a.is_active AND length(a.content) > 200
       AND a.article_number ~* '(bis|ter|quater|quáter|quinquies|sexies)'
       AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id=a.id AND q.is_active)
       AND EXISTS (SELECT 1 FROM topic_scope ts JOIN topics tp ON tp.id=ts.topic_id
                     JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
                    WHERE ts.law_id=a.law_id
                      AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
                      AND tp.disponible AND o.is_active)`);
  console.log('artículos de reforma huérfanos que quedan en TODO el banco:', d.rows[0].reforma_huerfanos_restantes);
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
