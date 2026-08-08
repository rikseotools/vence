const { Client } = require('pg');
(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''),ssl:{rejectUnauthorized:false}});
  await c.connect();
  const arts=['183','192','43','91','90','92','93','102','73'];
  const r=await c.query(`
    SELECT a.article_number art, length(a.content) len,
      (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id) tot,
      (SELECT count(DISTINCT tp.id) FROM topic_scope ts JOIN topics tp ON tp.id=ts.topic_id
         JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
        WHERE ts.law_id=a.law_id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
          AND tp.disponible AND o.is_active) temas
    FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.slug='rdl-2-2004' AND a.article_number=ANY($1) ORDER BY temas DESC`,[arts]);
  console.table(r.rows);
  const sel=['183','192','43','91','90','92'];
  const t=await c.query(`
    SELECT count(DISTINCT tp.id) temas, count(DISTINCT tp.position_type) opos
    FROM articles a JOIN laws l ON l.id=a.law_id
    JOIN topic_scope ts ON ts.law_id=l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    JOIN topics tp ON tp.id=ts.topic_id JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
    WHERE l.slug='rdl-2-2004' AND a.article_number=ANY($1) AND tp.disponible AND o.is_active`,[sel]);
  console.log('lote propuesto', sel.join(','), '→', t.rows[0]);
  const tex=await c.query(`SELECT a.article_number, a.title, a.content FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.slug='rdl-2-2004' AND a.article_number=ANY($1)`,[sel]);
  for(const x of tex.rows) console.log('\n===== ART '+x.article_number+' — '+x.title+' =====\n'+x.content);
  await c.end();
})();
