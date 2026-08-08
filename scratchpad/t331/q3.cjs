const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const inact = await c.query(`SELECT q.id, q.question_text, q.lifecycle_state, q.deactivation_reason, q.option_a,q.option_b,q.option_c,q.option_d,q.correct_option
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE l.short_name='RD 203/2021' AND a.article_number='50'`);
  console.log('--- art50 preguntas (todas):'); console.log(JSON.stringify(inact.rows,null,1));
  const dup = await c.query(`SELECT a.article_number, q.id, q.is_active, left(q.question_text,160) t
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE l.short_name='RD 203/2021' AND (q.question_text ILIKE '%marca de tiempo%' OR q.question_text ILIKE '%sello%tiempo%' OR q.question_text ILIKE '%referencia temporal%' OR q.question_text ILIKE '%acceso al expediente%' OR q.question_text ILIKE '%Punto de Acceso General%' OR q.option_a ILIKE '%marca de tiempo%' OR q.option_b ILIKE '%marca de tiempo%')
    ORDER BY a.article_number::int`);
  console.log('--- posibles solapes:'); for(const r of dup.rows) console.log(r.article_number, r.is_active?'ACT':'off', r.t);
  // buscar en TODO el banco (otras leyes) por si hay preguntas equivalentes
  const glob = await c.query(`SELECT l.short_name, a.article_number, q.is_active, left(q.question_text,140) t
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE q.is_active AND (q.question_text ILIKE '%sello electrónico cualificado de tiempo%' OR q.question_text ILIKE '%marca de tiempo%')
    LIMIT 25`);
  console.log('--- banco global marca/sello de tiempo:'); for(const r of glob.rows) console.log(r.short_name,'art'+r.article_number, r.t);
  await c.end();
})();
