const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const d = await c.query(`SELECT a.article_number, q.id, q.lifecycle_state, left(q.question_text,110) t, left(coalesce(q.explanation,''),80) e, q.tags
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE l.slug='ley-9-2017' AND q.lifecycle_state <> 'approved' AND a.article_number = ANY($1)`,[['134','137','138','140','141','142','143','144','146','147','148','151']]);
  console.log('borradores/no aprobadas en los candidatos:');
  for (const x of d.rows) console.log('  art',x.article_number, x.lifecycle_state, '|', x.t, '| expl:', JSON.stringify(x.e));
  const alt = await c.query(`
    SELECT a.article_number, length(a.content) len,
      (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id) tot,
      (SELECT count(DISTINCT tp.id) FROM topic_scope ts JOIN topics tp ON tp.id=ts.topic_id
        JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
        WHERE ts.law_id=a.law_id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
          AND tp.disponible AND o.is_active) temas
    FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.slug='ley-9-2017' AND a.is_active AND a.article_number ~ '^[0-9]+$'
      AND a.article_number::int BETWEEN 131 AND 155
      AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id=a.id)
    ORDER BY temas DESC, length(a.content) DESC LIMIT 14`);
  console.log('\nartículos 131-155 SIN NINGUNA pregunta (ni draft), por alcance vivo:');
  console.table(alt.rows);
  await c.end();
})();
