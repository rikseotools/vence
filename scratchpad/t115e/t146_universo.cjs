const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const ley = await c.query(`SELECT id, slug, short_name, name, boe_url FROM laws WHERE slug ILIKE '%12-2007%' OR name ILIKE '%igualdad%género%andaluc%'`);
  console.table(ley.rows.map(r => ({ slug: r.slug, short: r.short_name, boe_url: (r.boe_url||'').slice(0,70) })));
  if (!ley.rows.length) { await c.end(); return; }
  const lawId = ley.rows[0].id;
  // UNIVERSO: todo artículo de reforma ACTIVO de esta ley, con su cobertura real.
  const r = await c.query(`
    SELECT a.article_number, length(a.content) AS len,
           count(q.id) FILTER (WHERE q.is_active) AS activas,
           count(q.id) FILTER (WHERE q.lifecycle_state='draft') AS borrador,
           a.content ILIKE '%derogad%' AS menciona_derogado
      FROM articles a
      LEFT JOIN questions q ON q.primary_article_id = a.id
     WHERE a.law_id=$1 AND a.is_active
       AND a.article_number ~* '(bis|ter|quater|quáter|quinquies|sexies)'
     GROUP BY a.article_number, a.content
     ORDER BY (count(q.id) FILTER (WHERE q.is_active)) ASC, length(a.content) DESC`, [lawId]);
  console.log(`\nUNIVERSO de artículos de reforma activos: ${r.rows.length}`);
  console.table(r.rows);
  const t = await c.query(`
    SELECT count(DISTINCT tp.id) AS temas, count(DISTINCT tp.position_type) AS oposiciones
      FROM topic_scope ts JOIN topics tp ON tp.id=ts.topic_id
      JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
     WHERE ts.law_id=$1 AND tp.disponible AND o.is_active`, [lawId]);
  console.log('alcance de la ley:', JSON.stringify(t.rows[0]));
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
