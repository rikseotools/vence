const { Client } = require('pg');
(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''),ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r=await c.query(`SELECT q.lifecycle_state, count(*) n, min(left(q.question_text,70)) ej
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE l.slug='rdl-2-2004' AND a.article_number='92' GROUP BY 1`);
  console.log('art 92 — estado de sus 5 preguntas:'); console.table(r.rows);
  const t=await c.query(`
    SELECT count(DISTINCT tp.id) temas, count(DISTINCT tp.position_type) opos
    FROM articles a JOIN laws l ON l.id=a.law_id
    JOIN topic_scope ts ON ts.law_id=l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    JOIN topics tp ON tp.id=ts.topic_id JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
    WHERE l.slug='rdl-2-2004' AND a.article_number=ANY($1) AND tp.disponible AND o.is_active`,[['183','192','43','91','90']]);
  console.log('lote de 5 artículos LIMPIOS (183,192,43,91,90) →', t.rows[0]);
  await c.end();
})();
