const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`
    SELECT a.article_number,
      (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id AND q.is_active) act
    FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.slug='ley-9-2017' AND a.article_number = ANY($1) ORDER BY a.article_number::int`, [['137','138','140','142','146','148']]);
  console.log('preguntas activas por artículo:'); for(const x of r.rows) console.log('  art', x.article_number, '→', x.act);
  const t = await c.query(`
    SELECT count(DISTINCT tp.id) temas, count(DISTINCT tp.position_type) oposiciones
    FROM articles a JOIN laws l ON l.id=a.law_id
    JOIN topic_scope ts ON ts.law_id=l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    JOIN topics tp ON tp.id=ts.topic_id JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
    WHERE l.slug='ley-9-2017' AND a.article_number = ANY($1) AND tp.disponible AND o.is_active`, [['137','138','140','142','146','148']]);
  console.log('alcance vivo:', t.rows[0]);
  await c.end();
})();
