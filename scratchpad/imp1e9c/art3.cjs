require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const lawId = (await c.query(`SELECT law_id FROM articles WHERE id=(SELECT primary_article_id FROM questions WHERE id=(SELECT question_id FROM question_disputes WHERE id='1e9c09f6-b0c1-4d86-bc16-871c9c73777c'))`)).rows[0].law_id;
  const a = await c.query(`SELECT article_number, content FROM articles WHERE law_id=$1 AND article_number IN ('3','4') ORDER BY article_number`, [lawId]);
  for (const r of a.rows) console.log('=== ART', r.article_number, '===\n', r.content, '\n');
  const l = await c.query(`SELECT short_name, boe_url FROM laws WHERE id=$1`, [lawId]);
  console.log(l.rows[0]);
  const h = await c.query(`SELECT id, question_text, correct_option FROM questions
    WHERE is_active=true AND (option_a ILIKE '%equidad habrá de ponderarse%' OR option_b ILIKE '%equidad habrá de ponderarse%' OR option_c ILIKE '%equidad habrá de ponderarse%' OR option_d ILIKE '%equidad habrá de ponderarse%')`);
  console.log('Preguntas activas con el distractor de equidad:', h.rows.length);
  for (const x of h.rows) console.log('-', x.id.slice(0,8), '|', x.question_text.replace(/\s+/g,' ').slice(0,110));
  await c.end();
})();
