// T-146 segunda mitad: los artículos de REFORMA (bis/ter/…) que sirven 0 preguntas,
// ordenados por ALCANCE VIVO — que es el criterio que hoy ha demostrado valer 10x.
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`
    SELECT l.short_name ley, l.slug, a.article_number art, length(a.content) len,
           (a.vigencia_notes IS NOT NULL) nota,
           count(DISTINCT tp.id) temas, count(DISTINCT tp.position_type) opos
    FROM articles a
    JOIN laws l ON l.id = a.law_id
    JOIN topic_scope ts ON ts.law_id = l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    JOIN topics tp ON tp.id = ts.topic_id AND tp.disponible
    JOIN oposiciones o ON replace(o.slug,'-','_') = tp.position_type AND o.is_active
    WHERE a.is_active
      AND a.article_number ~* '^[0-9]+ ?(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)$'
      AND length(coalesce(a.content,'')) > 200
      AND a.content NOT ILIKE '%derogado%'
      AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)
    GROUP BY 1,2,3,4,5
    ORDER BY count(DISTINCT tp.id) DESC, length(a.content) DESC
    LIMIT 14`);
  console.log('artículos de REFORMA con 0 preguntas, por alcance vivo:');
  console.table(r.rows.map(x => ({ ley: x.ley.slice(0,28), art: x.art, chars: x.len, temas: x.temas, opos: x.opos, nota: x.nota ? '⚠️' : '' })));
  const tot = await c.query(`
    SELECT count(*) n FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE a.is_active AND a.article_number ~* '^[0-9]+ ?(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)$'
      AND length(coalesce(a.content,''))>200 AND a.content NOT ILIKE '%derogado%'
      AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id=a.id AND q.is_active)
      AND EXISTS (SELECT 1 FROM topic_scope ts JOIN topics tp ON tp.id=ts.topic_id AND tp.disponible
                  JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type AND o.is_active
                  WHERE ts.law_id=a.law_id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers)))`);
  console.log('total de artículos de reforma escopados vivos y a cero:', tot.rows[0].n);
  await c.end();
})();
