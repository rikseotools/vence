require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const { Client } = require('pg');
const { SQL_UNIVERSO_COBERTURA } = require('../lib/generacion/huerfanosPlan.js');

// La banda que NINGÚN detector ve:
//   empty_topic        → exige 0 preguntas servidas
//   low_coverage       → exige <6 preguntas servidas
//   article_no_coverage→ exige cobertura de artículos >= 60%
// Queda fuera: tema con >=6 preguntas, >=4 artículos huérfanos y cobertura < 60%.
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const r = (await c.query(`
    WITH art AS (
      SELECT tp.position_type, tp.topic_number, tp.id topic_id,
             count(*)::int n_content,
             count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::int n_cov
        FROM topic_scope ts
        JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active AND tp.disponible
        JOIN laws l ON l.id = ts.law_id
        JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
        JOIN articles a ON a.law_id = ts.law_id AND a.article_number = an.num AND a.is_active
       WHERE length(coalesce(a.content,'')) > 40 AND a.content NOT ILIKE '%derogado%'
         AND ${SQL_UNIVERSO_COBERTURA}
       GROUP BY 1,2,3
    ), q AS (
      SELECT tp.id topic_id, COALESCE(SUM(s.total_questions),0)::int preguntas
        FROM topics tp LEFT JOIN topic_law_question_summary s ON s.topic_id = tp.id
       GROUP BY tp.id
    )
    SELECT art.position_type, art.topic_number, art.n_content, art.n_cov,
           (art.n_content - art.n_cov) huerfanos,
           round(art.n_cov::numeric / art.n_content, 2) cobertura, q.preguntas
      FROM art JOIN q ON q.topic_id = art.topic_id
     WHERE art.n_content - art.n_cov >= 4                     -- hay hueco real
       AND art.n_cov::float / art.n_content < 0.6             -- article_no_coverage NO dispara
       AND q.preguntas >= 6                                   -- low_coverage/empty_topic NO disparan
     ORDER BY q.preguntas ASC, huerfanos DESC`)).rows;

  console.log('temas en la BANDA CIEGA (>=6 preguntas, >=4 huérfanos, cobertura <60%):', r.length);
  const opos = new Set(r.map(x => x.position_type));
  console.log('oposiciones afectadas:', opos.size);
  console.log('artículos huérfanos invisibles en total:', r.reduce((a, x) => a + Number(x.huerfanos), 0));
  console.log('\nlos 15 con MENOS preguntas servidas (los que más se notan al estudiar):');
  for (const x of r.slice(0, 15)) {
    console.log(`  ${x.position_type.padEnd(38)} T${String(x.topic_number).padStart(3)} · ${String(x.preguntas).padStart(4)} preg · ${x.n_cov}/${x.n_content} arts (${x.cobertura}) · ${x.huerfanos} huérfanos`);
  }
  const gva = r.find(x => x.position_type === 'subalterno_gva' && x.topic_number === 3);
  console.log('\nel caso de Neus:', gva ? JSON.stringify(gva) : 'NO aparece (revisar)');
  await c.end();
})();
