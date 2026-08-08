const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const arts = ['26','61','62','53 bis'];
  const r = await c.query(`
    SELECT a.id, a.article_number, a.title, a.is_active, length(a.content) len,
      (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id AND q.is_active) act,
      (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id) tot,
      (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id AND q.lifecycle_state='draft') borradores
    FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.slug='lo-3-2018' AND a.article_number = ANY($1) ORDER BY a.article_number`, [arts]);
  console.table(r.rows.map(x=>({art:x.article_number, titulo:x.title?.slice(0,58), activo:x.is_active, chars:x.len, act:x.act, tot:x.tot, draft:x.borradores})));
  const t = await c.query(`
    SELECT tp.position_type, tp.topic_number, a.article_number
    FROM articles a JOIN laws l ON l.id=a.law_id
    JOIN topic_scope ts ON ts.law_id=l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    JOIN topics tp ON tp.id=ts.topic_id
    LEFT JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
    WHERE l.slug='lo-3-2018' AND a.article_number = ANY($1) AND tp.disponible AND o.is_active
    ORDER BY 1,2`, [arts]);
  const m={}; for(const x of t.rows){const k=x.position_type+' T'+x.topic_number;(m[k]=m[k]||[]).push(x.article_number)}
  console.log('— ubicaciones vivas ('+Object.keys(m).length+'):');
  for(const [k,v] of Object.entries(m)) console.log('  ',k,'→',v.join(', '));
  await c.end();
})();
